import { query, queryOne, execute, transaction } from './index.js'
import * as invoices from './invoices.js'
import * as settings from './settings.js'
import { today, addDays } from '../lib/dates.js'

/**
 * Cotizaciones.
 *
 * Comparten tabla, editor, PDF y catalogo con las facturas — es el mismo
 * documento. Este modulo solo fija el tipo y anade lo unico que una
 * factura no tiene: convertirse en otra cosa.
 *
 * Las lecturas van por la vista `cotizaciones`, nunca por la tabla, para
 * que un presupuesto no pueda colarse en las cifras de dinero.
 */

export const ESTADOS = invoices.ESTADOS_COTIZACION

export const list = (opciones = {}) => invoices.list({ ...opciones, kind: 'quote' })
export const summary = () => invoices.summaryQuotes()
export const getFull = (id) => invoices.getFull(id)
export const save = (borrador) => invoices.save({ ...borrador, kind: 'quote' })
export const setStatus = (id, status) => invoices.setStatus(id, status)
export const remove = (id) => invoices.remove(id)

export const estaCaducada = invoices.estaCaducada
export const estaConvertida = invoices.estaConvertida

/** Validez por defecto de una cotizacion nueva, en dias. */
export const DIAS_DE_VALIDEZ = 30

export function validaHastaPorDefecto(desde = today()) {
  return addDays(desde, DIAS_DE_VALIDEZ)
}

/**
 * Convierte una cotizacion aceptada en factura.
 *
 * La cotizacion NO se transforma ni se borra: se queda en su historial,
 * marcada como aceptada y enlazada a la factura que salio de ella. Asi
 * puedes ver de donde vino cada factura y cuanto tardo en cerrarse.
 *
 * Todo ocurre en una transaccion: o quedan la factura y el enlace, o no
 * queda nada. Una factura sin enlazar seria un duplicado silencioso de la
 * cotizacion, y un enlace sin factura, un puntero roto.
 *
 * @returns {Promise<object>} La factura recien creada, con sus lineas.
 */
export async function convertirEnFactura(quoteId, { issue_date, due_date } = {}) {
  const cot = await queryOne(
    `SELECT * FROM cotizaciones WHERE id = $1`,
    [quoteId],
  )
  if (!cot) throw new Error('La cotización no existe')

  // El seguro contra convertir dos veces. Sin el, dos clics seguidos en
  // "Convertir" facturarian el mismo trabajo dos veces al mismo cliente.
  if (cot.converted_to_id != null) {
    throw new Error('Esta cotización ya se convirtió en factura')
  }

  const items = await query(
    `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position ASC, id ASC`,
    [quoteId],
  )

  // La fecha de validez de la cotizacion NO sirve como vencimiento de la
  // factura: son plazos distintos y la de la cotizacion suele estar ya casi
  // agotada cuando el cliente acepta. La factura arranca con tu plazo de
  // pago habitual, contado desde hoy.
  const emision = issue_date ?? today()
  const ajustes = await settings.get()
  const vencimiento = due_date ?? addDays(emision, ajustes.payment_terms_days ?? 15)

  // La factura se crea con `save`, que reserva el FAC- fiscal, recalcula
  // los totales desde las lineas y alimenta el CRM. La cotizacion conserva
  // su COT-.
  const factura = await invoices.save({
    id: null,
    number: null,
    kind: 'invoice',
    client: {
      name: cot.client_name,
      email: cot.client_email,
      phone: cot.client_phone,
      address: cot.client_address,
      tax_id: cot.client_tax_id,
    },
    items,
    issue_date: emision,
    due_date: vencimiento,
    status: 'pending',
    discount_type: cot.discount_type,
    discount_value: cot.discount_value,
    notes: cot.notes,
    payment_details: cot.payment_details,
    currency_symbol: cot.currency_symbol,
  })

  await transaction(async () => {
    await execute(
      `UPDATE invoices SET status = 'accepted', converted_to_id = $1 WHERE id = $2`,
      [factura.id, quoteId],
    )
  })

  return factura
}

/** La factura que salio de esta cotizacion, si ya se convirtio. */
export function facturaDe(quote) {
  if (!quote?.converted_to_id) return Promise.resolve(null)
  return queryOne(`SELECT * FROM facturas WHERE id = $1`, [quote.converted_to_id])
}

/** La cotizacion de la que salio esta factura, si vino de una. */
export function origenDe(invoiceId) {
  return queryOne(`SELECT * FROM cotizaciones WHERE converted_to_id = $1`, [invoiceId])
}
