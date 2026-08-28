import { query, queryOne, execute } from './index.js'
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
  // Los impuestos y retenciones SI se heredan, y sin preguntar: forman
  // parte del precio que el cliente acepto. Una cotizacion con ITBIS que
  // se convirtiera en una factura sin el estaria cobrando otra cifra.
  const adjustments = await query(
    `SELECT * FROM invoice_adjustments WHERE invoice_id = $1 ORDER BY position ASC, id ASC`,
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
    adjustments,
    issue_date: emision,
    due_date: vencimiento,
    status: 'pending',
    discount_type: cot.discount_type,
    discount_value: cot.discount_value,
    // Las notas NO se heredan. Son de la cotizacion ("Precios validos por
    // 30 dias", condiciones de la oferta...) y en una factura ya emitida no
    // pintan nada: en el mejor caso sobran y en el peor confunden al cliente,
    // que puede leer una condicion de presupuesto como una condicion de pago.
    // La factura arranca con el pie por defecto, igual que cualquier otra.
    notes: ajustes.default_notes ?? '',
    // Los datos de pago SI se heredan: dicen como cobrarte, que es
    // exactamente igual de valido en los dos documentos, y si los cambiaste
    // en la cotizacion (otra cuenta para ese cliente) esa decision debe
    // sobrevivir a la conversion.
    payment_details: cot.payment_details,
    currency_symbol: cot.currency_symbol,
    // La cabecera describe el TRABAJO (donde es, cuando, en que
    // condiciones), y el trabajo es el mismo que se cotizo. Se copia.
    service_place: cot.service_place,
    service_date_text: cot.service_date_text,
    credit_terms: cot.credit_terms,
    prepared_by: cot.prepared_by,
    // La factura deja escrito de que cotizacion salio. Ademas de que es el
    // dato que el cliente busca para cuadrarlas, es lo que rellena la
    // casilla "Cotización" del encabezado.
    quote_ref: cot.number,
  })

  // Un UPDATE por clave primaria es atomico por si mismo; no necesita
  // transaccion. Si aun asi fallara, la factura quedaria creada sin el
  // enlace, asi que se deshace: es preferible perder la factura —que se
  // vuelve a generar con un clic— a dejar la cotizacion convertible otra
  // vez y acabar facturando el mismo trabajo dos veces.
  try {
    await execute(
      `UPDATE invoices SET status = 'accepted', converted_to_id = $1 WHERE id = $2`,
      [factura.id, quoteId],
    )
  } catch (error) {
    await execute(`DELETE FROM invoices WHERE id = $1`, [factura.id])
    throw error
  }

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
