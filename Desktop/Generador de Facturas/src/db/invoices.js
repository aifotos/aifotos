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
 * Hace cuatro cosas en una sola transaccion:
 *   1. Crea o actualiza el cliente (alta silenciosa)
 *   2. Crea o actualiza cada servicio del catalogo (alta silenciosa)
 *   3. Recalcula los totales desde las lineas — nunca confia en el total
 *      que venga del formulario
 *   4. Reemplaza las lineas y guarda la cabecera
 *
 * Si algo falla, no se guarda nada.
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

  // El numero se reserva ANTES de la transaccion: `consumeNumber` hace su
  // propio UPDATE condicional y no debe deshacerse si la factura falla
  // (es preferible un hueco en la numeracion que un numero duplicado).
  const number = id ? borrador.number : await settings.consumeNumber()

  return transaction(async () => {
    // 1. Cliente
    const clienteGuardado = await clients.upsertByName(client)

    // 2. Catalogo de servicios
    const lineasConServicio = []
    for (const it of lineas) {
      const nombre = String(it.description ?? '').trim()
      let serviceId = it.service_id ?? null
      if (nombre) {
        const servicio = await services.upsertByName({
          name: nombre,
          unit_price_cents: it.unit_price_cents,
          unit: it.unit ?? 'unidad',
        })
        serviceId = servicio?.id ?? null
      }
      lineasConServicio.push({ ...it, service_id: serviceId })
    }

    // 3. Cabecera
    const campos = [
      clienteGuardado?.id ?? null,
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
           client_id = $1, client_name = $2, client_email = $3, client_phone = $4,
           client_address = $5, client_tax_id = $6, issue_date = $7, due_date = $8,
           status = $9, paid_at = COALESCE(paid_at, $10),
           subtotal_cents = $11, discount_type = $12, discount_value = $13,
           discount_cents = $14, total_cents = $15, currency_symbol = $16,
           notes = $17, payment_details = $18
         WHERE id = $19`,
        [...campos, id],
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

    // 4. Lineas: se reemplazan enteras. Es mas simple y mas seguro que
    //    intentar casar cual linea cambio, y son pocas filas.
    await execute(`DELETE FROM invoice_items WHERE invoice_id = $1`, [invoiceId])
    for (let i = 0; i < lineasConServicio.length; i++) {
      const it = lineasConServicio[i]
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
  }).then((invoiceId) => getFull(invoiceId))
}

// ------------------------------------------------------------ OPERACIONES

export async function setStatus(id, status) {
  await execute(
    `UPDATE invoices SET
       status  = $1,
       paid_at = CASE WHEN $1 = 'paid'
                      THEN COALESCE(paid_at, datetime('now'))
                      ELSE NULL END
     WHERE id = $2`,
    [status, id],
  )
  return getFull(id)
}

/** Borra la factura; sus lineas se van solas por ON DELETE CASCADE. */
export function remove(id) {
  return execute(`DELETE FROM invoices WHERE id = $1`, [id])
}

/** Duplica una factura como borrador nuevo, con numero nuevo y fecha de hoy. */
export async function duplicate(id) {
  const original = await getFull(id)
  if (!original) return null
  return save({
    id: null,
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
