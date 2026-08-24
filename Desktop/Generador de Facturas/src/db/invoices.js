import { query, queryOne, execute, atomico } from './index.js'
import { invoiceTotals, lineTotal } from '../lib/money.js'
import * as clients from './clients.js'
import * as services from './services.js'
import * as settings from './settings.js'

/**
 * Facturas. Aqui vive la operacion mas importante de la app: guardar una
 * factura completa (cabecera + lineas + alta silenciosa de cliente y
 * servicios) como una sola transaccion atomica.
 */

/**
 * Estados, separados por tipo de documento.
 *
 * No comparten vocabulario a proposito: "Pagada" no significa nada en una
 * cotizacion y "Aceptada" no significa nada en una factura. La base
 * tambien lo impide con un CHECK, para que un estado cruzado no pueda
 * entrar ni por error de la app.
 */
export const ESTADOS = {
  draft: { label: 'Borrador', tone: 'draft' },
  pending: { label: 'Pendiente', tone: 'pending' },
  paid: { label: 'Pagada', tone: 'paid' },
  cancelled: { label: 'Anulada', tone: 'draft' },
}

export const ESTADOS_COTIZACION = {
  draft: { label: 'Borrador', tone: 'draft' },
  sent: { label: 'Enviada', tone: 'pending' },
  accepted: { label: 'Aceptada', tone: 'paid' },
  rejected: { label: 'Rechazada', tone: 'draft' },
}

/** Los estados que corresponden a un tipo de documento. */
export function estadosDe(kind) {
  return kind === 'quote' ? ESTADOS_COTIZACION : ESTADOS
}

/** La vista desde la que se lee cada tipo. Nunca la tabla `invoices`. */
function vista(kind) {
  return kind === 'quote' ? 'cotizaciones' : 'facturas'
}

// ------------------------------------------------------------- CONSULTAS

/**
 * Listado del Dashboard, con filtro opcional por estado y busqueda.
 *
 * Lee de la vista, no de la tabla: asi una cotizacion no puede aparecer
 * jamas en el listado de facturas por un filtro olvidado.
 */
export function list({ kind = 'invoice', status = null, search = '', limit = 200 } = {}) {
  const t = search.trim().toLowerCase()
  return query(
    `SELECT i.*,
            (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) AS item_count
     FROM ${vista(kind)} i
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
     FROM facturas
     WHERE status != 'cancelled'`,
  )
}

/**
 * Resumen del panel de cotizaciones.
 *
 * "Valor cotizado" cuenta SOLO las que siguen vigentes. Una cotizacion
 * caducada sigue con status 'sent' en la base, pero meterla en esa cifra
 * seria presentar como cartera viva un presupuesto que ya expiro — la
 * misma clase de error que contar cotizaciones como dinero por cobrar,
 * solo que mas pequeno. Las caducadas tienen su propia tarjeta.
 */
export function summaryQuotes() {
  const vigente = `(due_date IS NULL OR due_date >= date('now'))`
  const caducada = `(due_date IS NOT NULL AND due_date < date('now'))`
  return queryOne(
    `SELECT
       COUNT(CASE WHEN status = 'sent' AND ${vigente} THEN 1 END) AS n_enviadas,
       COUNT(CASE WHEN status = 'accepted' THEN 1 END)            AS n_aceptadas,
       COUNT(CASE WHEN status = 'draft'    THEN 1 END)            AS n_borradores,
       COALESCE(SUM(CASE WHEN status = 'sent' AND ${vigente}
                         THEN total_cents END), 0)                AS valor_enviado,
       COUNT(CASE WHEN status = 'sent' AND ${caducada} THEN 1 END) AS n_caducadas
     FROM cotizaciones`,
  )
}

/**
 * Una factura pendiente cuya fecha de vencimiento ya paso: es una deuda.
 *
 * Distinto de una cotizacion caducada (`estaCaducada`), que no es dinero
 * que te deban sino un presupuesto que dejo de estar vigente. Comparten
 * el campo `due_date` pero no significan lo mismo, y por eso no comparten
 * ni funcion ni color.
 */
export function isOverdue(invoice) {
  if (invoice.kind === 'quote') return false
  if (invoice.status !== 'pending' || !invoice.due_date) return false
  return invoice.due_date < new Date().toISOString().slice(0, 10)
}

/** Una cotizacion enviada cuya fecha de validez ya paso. */
export function estaCaducada(doc) {
  if (doc.kind !== 'quote' || doc.status !== 'sent' || !doc.due_date) return false
  return doc.due_date < new Date().toISOString().slice(0, 10)
}

/** ¿Esta cotizacion ya se convirtio en factura? */
export function estaConvertida(doc) {
  return doc.kind === 'quote' && doc.converted_to_id != null
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
    kind = 'invoice',
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
  //   borrador nuevo        -> BOR-0003 (interno, no gasta correlativo)
  //   borrador que sigue     -> conserva su BOR-0003
  //   al emitir una factura  -> se reserva el FAC-0007 fiscal
  //   al enviar una cotiz.   -> se reserva el COT-0003, secuencia aparte
  //   documento ya emitido   -> nunca cambia de numero
  let number = borrador.number ?? null
  if (status === 'draft') {
    if (!number) number = await settings.consumeDraftNumber()
  } else if (settings.esBorrador(number)) {
    number = kind === 'quote'
      ? await settings.consumeQuoteNumber()
      : await settings.consumeNumber()
  }

  // El cliente solo se enlaza si YA existe en el catalogo. Uno nuevo se da
  // de alta al emitir, no ahora.
  const clienteExistente = client.name?.trim() ? await clients.getByName(client.name) : null

  // Las sentencias se preparan TODAS antes de tocar la base y se mandan en
  // un solo lote atomico. Antes se ejecutaban una a una dentro de un BEGIN
  // que no agrupaba nada (ver `atomico` en index.js), y bastaba que una
  // fallara para dejar escrito todo lo anterior: cabecera con su total y
  // cero lineas.
  //
  // Las lineas se enganchan a la factura por su `number`, que es UNIQUE, y
  // no por el id: dentro de un lote no se puede leer el id que acaba de
  // generar el INSERT anterior, y el numero ya lo conocemos aqui.
  const porNumero = `(SELECT id FROM invoices WHERE number = ?)`

  const campos = [
    kind,
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

  const sentencias = []

  if (id) {
    sentencias.push({
      sql: `UPDATE invoices SET
              number = ?, kind = ?,
              client_id = ?, client_name = ?, client_email = ?, client_phone = ?,
              client_address = ?, client_tax_id = ?, issue_date = ?, due_date = ?,
              status = ?, paid_at = COALESCE(paid_at, ?),
              subtotal_cents = ?, discount_type = ?, discount_value = ?,
              discount_cents = ?, total_cents = ?, currency_symbol = ?,
              notes = ?, payment_details = ?
            WHERE id = ?`,
      params: [number, ...campos, id],
    })
  } else {
    sentencias.push({
      sql: `INSERT INTO invoices
              (number, kind, client_id, client_name, client_email, client_phone,
               client_address, client_tax_id, issue_date, due_date, status, paid_at,
               subtotal_cents, discount_type, discount_value, discount_cents,
               total_cents, currency_symbol, notes, payment_details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [number, ...campos],
    })
  }

  // Las lineas se reemplazan enteras: mas simple y mas seguro que intentar
  // casar cual cambio, y son pocas filas.
  sentencias.push({
    sql: `DELETE FROM invoice_items WHERE invoice_id = ${porNumero}`,
    params: [number],
  })

  lineas.forEach((it, i) => {
    sentencias.push({
      sql: `INSERT INTO invoice_items
              (invoice_id, service_id, position, description, quantity_milli,
               unit, unit_price_cents, line_total_cents)
            VALUES (${porNumero}, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        number,
        it.service_id ?? null,
        i,
        String(it.description ?? '').trim(),
        it.quantity_milli,
        it.unit ?? 'unidad',
        it.unit_price_cents,
        lineTotal(it.quantity_milli, it.unit_price_cents),
      ],
    })
  })

  await atomico(sentencias)

  const guardada = await queryOne(`SELECT id FROM invoices WHERE number = $1`, [number])
  if (!guardada) throw new Error(`No se pudo guardar ${number}`)
  const idFactura = guardada.id

  // Un documento que sale de borrador alimenta el CRM y el catalogo — sea
  // factura o cotizacion. Si le cotizas a alguien es un cliente real
  // aunque todavia no te haya dicho que si, y no tiene sentido volver a
  // teclear sus datos cuando acepte.
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
  // Cuenta facturas Y cotizaciones: para ordenar el autocompletado importa
  // con quien trabajas, no si el papel era fiscal. (Aqui si se lee la
  // tabla cruda a proposito, y es el unico sitio donde pasa.)
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
  const actual = await queryOne(
    `SELECT number, status, kind FROM invoices WHERE id = $1`,
    [id],
  )
  if (!actual) return null

  if (!estadosDe(actual.kind)[status]) {
    throw new Error(`Estado "${status}" no valido para un documento de tipo ${actual.kind}`)
  }

  const number =
    status !== 'draft' && settings.esBorrador(actual.number)
      ? actual.kind === 'quote'
        ? await settings.consumeQuoteNumber()
        : await settings.consumeNumber()
      : actual.number

  await execute(
    `UPDATE invoices SET
       number  = $1,
       status  = $2,
       paid_at = CASE WHEN $2 IN ('paid', 'accepted')
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
