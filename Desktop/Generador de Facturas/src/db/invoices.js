import { query, queryOne, execute, transaction } from './index.js'
import { invoiceTotals, lineTotal } from '../lib/money.js'
import * as clients from './clients.js'
import * as services from './services.js'
import * as settings from './settings.js'

/**
 * Facturas. Aqui vive la operacion mas importante de la app: guardar una
 * factura completa (cabecera + lineas + alta silenciosa de cliente y
 * servicios) como una sola transaccion atomica.
 */

export const ESTADOS = {
  draft: { label: 'Borrador', tone: 'draft' },
  pending: { label: 'Pendiente', tone: 'pending' },
  paid: { label: 'Pagada', tone: 'paid' },
  cancelled: { label: 'Anulada', tone: 'draft' },
}

// ------------------------------------------------------------- CONSULTAS

/** Listado del Dashboard, con filtro opcional por estado y busqueda. */
export function list({ status = null, search = '', limit = 200 } = {}) {
  const t = search.trim().toLowerCase()
  return query(
    `SELECT i.*,
            (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) AS item_count
     FROM invoices i
     WHERE ($1 IS NULL OR i.status = $1)
       AND ($2 = '' OR lower(i.number) LIKE $3 OR lower(i.client_name) LIKE $3)
     ORDER BY i.issue_date DESC, i.id DESC
     LIMIT $4`,
    [status, t, `%${t}%`, limit],
  )
}

/** Una factura con sus lineas, lista para abrir en el editor o imprimir. */
export async function getFull(id) {
  const invoice = await queryOne(`SELECT * FROM invoices WHERE id = $1`, [id])
  if (!invoice) return null
  const items = await query(
    `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position ASC, id ASC`,
    [id],
  )
  return { ...invoice, items }
}

/** Tarjetas de resumen del Dashboard. */
export function summary() {
  return queryOne(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'paid'    THEN total_cents END), 0) AS cobrado,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN total_cents END), 0) AS por_cobrar,
       COUNT(CASE WHEN status = 'pending' THEN 1 END)                      AS n_pendientes,
       COUNT(CASE WHEN status = 'draft'   THEN 1 END)                      AS n_borradores,
       COALESCE(SUM(CASE WHEN status = 'pending'
                          AND due_date IS NOT NULL
                          AND due_date < date('now') THEN total_cents END), 0) AS vencido
     FROM invoices
     WHERE status != 'cancelled'`,
  )
}

/** Una factura pendiente cuya fecha de vencimiento ya paso. */
export function isOverdue(invoice) {
  if (invoice.status !== 'pending' || !invoice.due_date) return false
  return invoice.due_date < new Date().toISOString().slice(0, 10)
}

// -------------------------------------------------------------- GUARDADO

/**
 * Guarda una factura entera. Es la unica funcion que deberia usar el editor.
 *
 * En una sola transaccion: recalcula los totales desde las lineas (nunca
 * confia en el total que venga del formulario), guarda la cabecera y
 * reemplaza las lineas. Si algo falla, no se guarda nada.
 *
 * NO da de alta clientes ni servicios. Eso lo hace `aprender()`, y solo
 * cuando la factura se emite — ver el comentario de esa funcion.
 *
 * @param {object} borrador  Estado del formulario
 * @param {number|null} borrador.id  null para una factura nueva
 * @returns {Promise<object>} La factura guardada, con sus lineas
 */
export async function save(borrador) {
  const {
    id = null,
    client = {},
    items = [],
    issue_date,
    due_date = null,
    status = 'draft',
    discount_type = 'none',
    discount_value = 0,
    notes = '',
    payment_details = '',
    currency_symbol = 'RD$',
  } = borrador

  // Las lineas vacias no llegan a la base de datos.
  const lineas = items.filter(
    (it) => String(it.description ?? '').trim() !== '' || it.unit_price_cents > 0,
  )

  const totales = invoiceTotals(lineas, discount_type, discount_value)

  // El numero se resuelve ANTES de la transaccion: las funciones de reserva
  // hacen su propio UPDATE condicional y no deben deshacerse si la factura
  // falla (es preferible un hueco que un numero duplicado).
  //
  //   borrador nuevo      -> BOR-0003 (interno, no consume numeracion fiscal)
  //   borrador que sigue  -> conserva su BOR-0003
  //   al emitir           -> se reserva el FAC-0007 real
  //   factura ya emitida  -> nunca cambia de numero
  let number = borrador.number ?? null
  if (status === 'draft') {
    if (!number) number = await settings.consumeDraftNumber()
  } else if (settings.esBorrador(number)) {
    number = await settings.consumeNumber()
  }

  // El cliente solo se enlaza si YA existe en el catalogo. Uno nuevo se da
  // de alta al emitir, no ahora.
  const clienteExistente = client.name?.trim() ? await clients.getByName(client.name) : null

  const idFactura = await transaction(async () => {
    const campos = [
      clienteExistente?.id ?? null,
      client.name ?? '',
      client.email ?? '',
      client.phone ?? '',
      client.address ?? '',
      client.tax_id ?? '',
      issue_date,
      due_date,
      status,
      status === 'paid' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
      totales.subtotal_cents,
      discount_type,
      discount_value,
      totales.discount_cents,
      totales.total_cents,
      currency_symbol,
      notes,
      payment_details,
    ]

    let invoiceId = id
    if (id) {
      await execute(
        `UPDATE invoices SET
           number = $1,
           client_id = $2, client_name = $3, client_email = $4, client_phone = $5,
           client_address = $6, client_tax_id = $7, issue_date = $8, due_date = $9,
           status = $10, paid_at = COALESCE(paid_at, $11),
           subtotal_cents = $12, discount_type = $13, discount_value = $14,
           discount_cents = $15, total_cents = $16, currency_symbol = $17,
           notes = $18, payment_details = $19
         WHERE id = $20`,
        [number, ...campos, id],
      )
    } else {
      const res = await execute(
        `INSERT INTO invoices
           (number, client_id, client_name, client_email, client_phone,
            client_address, client_tax_id, issue_date, due_date, status, paid_at,
            subtotal_cents, discount_type, discount_value, discount_cents,
            total_cents, currency_symbol, notes, payment_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                 $12, $13, $14, $15, $16, $17, $18, $19)`,
        [number, ...campos],
      )
      invoiceId = res.lastInsertId
    }

    // Lineas: se reemplazan enteras. Es mas simple y mas seguro que
    // intentar casar cual linea cambio, y son pocas filas.
    await execute(`DELETE FROM invoice_items WHERE invoice_id = $1`, [invoiceId])
    for (let i = 0; i < lineas.length; i++) {
      const it = lineas[i]
      await execute(
        `INSERT INTO invoice_items
           (invoice_id, service_id, position, description, quantity_milli,
            unit, unit_price_cents, line_total_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          invoiceId,
          it.service_id,
          i,
          String(it.description ?? '').trim(),
          it.quantity_milli,
          it.unit ?? 'unidad',
          it.unit_price_cents,
          lineTotal(it.quantity_milli, it.unit_price_cents),
        ],
      )
    }

    return invoiceId
  })

  // Una factura emitida si alimenta el CRM y el catalogo.
  if (status !== 'draft') await aprender(idFactura)

  return getFull(idFactura)
}

/**
 * Da de alta en el CRM y en el catalogo lo que aparece en una factura.
 *
 * Solo se llama al EMITIR, nunca durante el autoguardado de un borrador.
 * Es una distincion que importa: el autoguardado dispara mientras escribes,
 * asi que aprender ahi llenaria el catalogo con lo que hubiera a medio
 * teclear. Escribir "Video promocional" dejaria "vi", "vid", "video"...
 * como servicios reales, y el autocompletado quedaria inservible en una
 * semana. Un borrador es una idea; una factura emitida es un hecho.
 */
async function aprender(invoiceId) {
  const factura = await getFull(invoiceId)
  if (!factura) return

  const cliente = await clients.upsertByName({
    name: factura.client_name,
    email: factura.client_email,
    phone: factura.client_phone,
    address: factura.client_address,
    tax_id: factura.client_tax_id,
  })
  if (cliente) {
    await execute(`UPDATE invoices SET client_id = $1 WHERE id = $2`, [cliente.id, invoiceId])
  }

  for (const it of factura.items) {
    const nombre = String(it.description ?? '').trim()
    if (!nombre) continue
    const servicio = await services.upsertByName({
      name: nombre,
      unit_price_cents: it.unit_price_cents,
      unit: it.unit ?? 'unidad',
    })
    if (servicio) {
      await execute(`UPDATE invoice_items SET service_id = $1 WHERE id = $2`, [
        servicio.id,
        it.id,
      ])
    }
  }

  await recomputarUso()
}

/**
 * Recalcula `times_used` de clientes y servicios a partir de las facturas
 * reales, en lugar de ir sumando de uno en uno.
 *
 * Un contador que se incrementa se desincroniza en cuanto algo se guarda
 * dos veces, se edita una factura ya emitida o se borra una. Recalcularlo
 * es idempotente: da igual cuantas veces se ejecute, el numero siempre
 * refleja lo que hay. Son dos UPDATE sobre unas pocas filas.
 */
export async function recomputarUso() {
  await execute(
    `UPDATE clients SET
       times_used = (SELECT COUNT(*) FROM invoices
                     WHERE client_id = clients.id AND status != 'draft'),
       last_used_at = (SELECT MAX(issue_date) FROM invoices
                       WHERE client_id = clients.id AND status != 'draft')`,
  )
  await execute(
    `UPDATE services SET
       times_used = (SELECT COUNT(DISTINCT ii.invoice_id)
                     FROM invoice_items ii
                     JOIN invoices i ON i.id = ii.invoice_id
                     WHERE ii.service_id = services.id AND i.status != 'draft'),
       last_used_at = (SELECT MAX(i.issue_date)
                       FROM invoice_items ii
                       JOIN invoices i ON i.id = ii.invoice_id
                       WHERE ii.service_id = services.id AND i.status != 'draft')`,
  )
}

// ------------------------------------------------------------ OPERACIONES

/**
 * Cambia el estado de una factura.
 *
 * Si es la primera vez que sale de borrador, aqui es donde deja de ser
 * 'BOR-0003' y recibe su numero fiscal definitivo.
 */
export async function setStatus(id, status) {
  const actual = await queryOne(`SELECT number, status FROM invoices WHERE id = $1`, [id])
  if (!actual) return null

  const number =
    status !== 'draft' && settings.esBorrador(actual.number)
      ? await settings.consumeNumber()
      : actual.number

  await execute(
    `UPDATE invoices SET
       number  = $1,
       status  = $2,
       paid_at = CASE WHEN $2 = 'paid'
                      THEN COALESCE(paid_at, datetime('now'))
                      ELSE NULL END
     WHERE id = $3`,
    [number, status, id],
  )

  // Al dejar de ser borrador, la factura pasa a alimentar el CRM.
  if (actual.status === 'draft' && status !== 'draft') await aprender(id)
  else await recomputarUso()

  return getFull(id)
}

/** Borra la factura; sus lineas se van solas por ON DELETE CASCADE. */
export async function remove(id) {
  const r = await execute(`DELETE FROM invoices WHERE id = $1`, [id])
  await recomputarUso()
  return r
}

/** Duplica una factura como borrador nuevo, con numero nuevo y fecha de hoy. */
export async function duplicate(id) {
  const original = await getFull(id)
  if (!original) return null
  return save({
    id: null,
    number: null,   // el duplicado nace como borrador, con su propio numero
    client: {
      name: original.client_name,
      email: original.client_email,
      phone: original.client_phone,
      address: original.client_address,
      tax_id: original.client_tax_id,
    },
    items: original.items,
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: null,
    status: 'draft',
    discount_type: original.discount_type,
    discount_value: original.discount_value,
    notes: original.notes,
    payment_details: original.payment_details,
    currency_symbol: original.currency_symbol,
  })
}
