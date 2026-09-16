import { query, queryOne, execute, atomico, cuentaActual } from './index.js'
import { documentTotals, lineTotal } from '../lib/money.js'
import * as clients from './clients.js'
import * as services from './services.js'
import * as settings from './settings.js'

/**
 * Facturas y cotizaciones. Aqui vive la operacion mas importante de la app:
 * guardar un documento completo (cabecera + lineas + impuestos) como una
 * sola transaccion atomica.
 *
 * Todo lo que se lee pasa por una vista (`facturas`, `cotizaciones`,
 * `mis_documentos`), nunca por la tabla `invoices`. Las vistas filtran por
 * tipo Y por la cuenta de la sesion, asi que ni una cotizacion puede
 * colarse en las cifras de dinero ni una factura de remont puede aparecer
 * en el historial de aifotos.
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
  return kind === 'quote' ? 'cotizaciones' : 'facturas_saldos'
}

// ------------------------------------------------------------- CONSULTAS

/**
 * Listado del Dashboard, con filtro opcional por estado y busqueda.
 */
export function list({ kind = 'invoice', status = null, search = '', limit = 200 } = {}) {
  const partial = kind === 'invoice' && status === 'partial'
  const t = search.trim().toLowerCase()
  return query(
    `SELECT i.*,
            (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) AS item_count
     FROM ${vista(kind)} i
     WHERE ($1 IS NULL OR i.status = $1)
       AND ${partial ? "i.status = 'pending' AND i.paid_cents > 0 AND i.paid_cents < i.total_cents" : '1=1'}
       AND ($2 = '' OR lower(i.number) LIKE $3 OR lower(i.client_name) LIKE $3)
     ORDER BY i.issue_date DESC, i.id DESC
     LIMIT $4`,
    [partial ? null : status, t, `%${t}%`, limit],
  )
}

/**
 * Un documento con sus lineas y sus impuestos, listo para abrir o imprimir.
 */
export async function getFull(id) {
  const invoice = await queryOne(`SELECT * FROM mis_documentos WHERE id = $1`, [id])
  if (!invoice) return null
  const [items, adjustments] = await Promise.all([
    query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position ASC, id ASC`,
      [id],
    ),
    query(
      `SELECT * FROM invoice_adjustments WHERE invoice_id = $1 ORDER BY position ASC, id ASC`,
      [id],
    ),
  ])
  const pago = await queryOne('SELECT COALESCE(SUM(amount_cents),0) AS paid_cents FROM mis_pagos WHERE invoice_id=$1', [id])
  return { ...invoice, ...pago, items, adjustments }
}

/** Tarjetas de resumen del Dashboard. */
export function summary() {
  return queryOne(
    `SELECT
       COALESCE(SUM(CASE WHEN status IN ('paid','pending') THEN paid_cents END), 0) AS cobrado,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN total_cents-paid_cents END), 0) AS por_cobrar,
       COUNT(CASE WHEN status = 'pending' THEN 1 END)                      AS n_pendientes,
       COUNT(CASE WHEN status = 'draft'   THEN 1 END)                      AS n_borradores,
       COALESCE(SUM(CASE WHEN status = 'pending'
                          AND due_date IS NOT NULL
                          AND due_date < date('now') THEN total_cents-paid_cents END), 0) AS vencido
     FROM facturas_saldos
     WHERE status != 'cancelled'`,
  )
}

/**
 * Resumen del panel de cotizaciones.
 *
 * "Valor cotizado" cuenta SOLO las que siguen vigentes. Una cotizacion
 * caducada sigue con status 'sent' en la base, pero meterla en esa cifra
 * seria presentar como cartera viva un presupuesto que ya expiro.
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

/** Una factura pendiente cuya fecha de vencimiento ya paso: es una deuda. */
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
 * Guarda un documento entero. Es la unica funcion que deberia usar el editor.
 *
 * En una sola transaccion: recalcula los totales desde las lineas y las
 * reglas de impuesto (nunca confia en el total que venga del formulario),
 * guarda la cabecera, reemplaza las lineas y reemplaza los impuestos
 * aplicados. Si algo falla, no se guarda nada.
 *
 * NO da de alta clientes ni servicios. Eso lo hace `aprender()`, y solo
 * cuando el documento se emite — ver el comentario de esa funcion.
 *
 * @param {object} borrador  Estado del formulario
 * @param {number|null} borrador.id  null para un documento nuevo
 * @returns {Promise<object>} El documento guardado, con lineas e impuestos
 */
export async function save(borrador) {
  const {
    id = null,
    kind = 'invoice',
    client = {},
    items = [],
    adjustments = [],
    issue_date,
    due_date = null,
    status: requestedStatus = 'draft',
    discount_type = 'none',
    discount_value = 0,
    notes = '',
    payment_details = '',
    currency_symbol = 'RD$',
    service_place = '',
    service_date_text = '',
    credit_terms = '',
    quote_ref = '',
    prepared_by = '',
  } = borrador

  const cuenta = await cuentaActual()
  const anterior = id ? await queryOne('SELECT * FROM mis_documentos WHERE id=$1', [id]) : null
  if (id && !anterior) throw new Error('El documento no está disponible en esta cuenta')
  // Un autoguardado en cola no puede devolver a borrador un documento ya emitido.
  const status = requestedStatus === 'draft' && anterior && anterior.status !== 'draft'
    ? anterior.status : requestedStatus

  // Las lineas vacias no llegan a la base de datos.
  const lineas = items.filter(
    (it) => String(it.description ?? '').trim() !== '' || it.unit_price_cents > 0,
  )

  const totales = documentTotals(lineas, discount_type, discount_value, adjustments)

  // El numero se resuelve ANTES de la transaccion: las funciones de reserva
  // hacen su propio UPDATE condicional y no deben deshacerse si el guardado
  // falla (es preferible un hueco que un numero duplicado).
  //
  //   borrador nuevo        -> BOR-0003 (interno, no gasta correlativo)
  //   borrador que sigue    -> conserva su BOR-0003
  //   al emitir una factura -> se reserva el numero fiscal
  //   al enviar una cotiz.  -> se reserva el COT-0003, secuencia aparte
  //   documento ya emitido  -> nunca cambia de numero
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
  // Las lineas se enganchan al documento por su numero, y no por el id:
  // dentro de un lote no se puede leer el id que acaba de generar el INSERT
  // anterior, y el numero ya lo conocemos aqui. Va con la cuenta porque el
  // numero solo es unico DENTRO de cada cuenta: sin el `account_id`, la
  // factura 00025 de remont podria engancharse a la de aifotos.
  const porNumero = `(SELECT id FROM invoices WHERE account_id = ? AND number = ?)`
  const clave = [cuenta, number]

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
    service_place ?? '',
    service_date_text ?? '',
    credit_terms ?? '',
    quote_ref ?? '',
    prepared_by ?? '',
    totales.subtotal_cents,
    discount_type,
    discount_value,
    totales.discount_cents,
    totales.tax_cents,
    totales.retention_cents,
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
              service_place = ?, service_date_text = ?, credit_terms = ?,
              quote_ref = ?, prepared_by = ?,
              subtotal_cents = ?, discount_type = ?, discount_value = ?,
              discount_cents = ?, tax_cents = ?, retention_cents = ?,
              total_cents = ?, currency_symbol = ?, notes = ?, payment_details = ?
            WHERE id = ? AND account_id = ?`,
      params: [number, ...campos, id, cuenta],
    })
  } else {
    sentencias.push({
      sql: `INSERT INTO invoices
              (account_id, number, kind, client_id, client_name, client_email,
               client_phone, client_address, client_tax_id, issue_date, due_date,
               status, paid_at, service_place, service_date_text, credit_terms,
               quote_ref, prepared_by, subtotal_cents, discount_type,
               discount_value, discount_cents, tax_cents, retention_cents,
               total_cents, currency_symbol, notes, payment_details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [cuenta, number, ...campos],
    })
  }

  // Lineas e impuestos se reemplazan enteros: mas simple y mas seguro que
  // intentar casar cual cambio, y son pocas filas.
  sentencias.push({
    sql: `DELETE FROM invoice_items WHERE invoice_id = ${porNumero}`,
    params: [...clave],
  })
  sentencias.push({
    sql: `DELETE FROM invoice_adjustments WHERE invoice_id = ${porNumero}`,
    params: [...clave],
  })

  lineas.forEach((it, i) => {
    sentencias.push({
      sql: `INSERT INTO invoice_items
              (invoice_id, service_id, position, description, detail,
               quantity_milli, unit, unit_price_cents, line_total_cents)
            VALUES (${porNumero}, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        ...clave,
        it.service_id ?? null,
        i,
        String(it.description ?? '').trim(),
        String(it.detail ?? '').trim(),
        it.quantity_milli,
        it.unit ?? 'unidad',
        it.unit_price_cents,
        lineTotal(it.quantity_milli, it.unit_price_cents),
      ],
    })
  })

  // Se guarda el importe YA CALCULADO junto a la tasa, no solo la regla.
  // Es la misma decision que congelar los datos del cliente: si manana
  // cambias el ISR al 3 %, esta factura debe seguir diciendo lo que dijo el
  // dia que la emitiste, porque es lo que el cliente pago.
  totales.ajustes.forEach((a, i) => {
    sentencias.push({
      sql: `INSERT INTO invoice_adjustments
              (invoice_id, rule_id, position, name, kind, base, rate_bp, amount_cents)
            VALUES (${porNumero}, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        ...clave,
        a.rule_id ?? null,
        i,
        a.name,
        a.kind,
        a.base,
        a.rate_bp,
        a.amount_cents,
      ],
    })
  })

  if (borrador.sourceQuoteId) {
    sentencias.push({ sql: `INSERT INTO quote_conversions(quote_id,invoice_id) VALUES (?, ${porNumero})`, params: [borrador.sourceQuoteId, ...clave] })
  }
  await atomico(sentencias)

  const guardada = await queryOne(
    `SELECT id FROM invoices WHERE account_id = $1 AND number = $2`,
    [cuenta, number],
  )
  if (!guardada) throw new Error(`No se pudo guardar ${number}`)
  const idFactura = guardada.id

  // Un documento que sale de borrador alimenta el CRM y el catalogo — sea
  // factura o cotizacion. Si le cotizas a alguien es un cliente real
  // aunque todavia no te haya dicho que si.
  if (status !== 'draft' && (!anterior || anterior.status === 'draft')) {
    try { await aprender(idFactura) } catch (e) { console.error('No se pudo actualizar el catálogo', e) }
  }

  return getFull(idFactura)
}

/**
 * Da de alta en el CRM y en el catalogo lo que aparece en un documento.
 *
 * Solo se llama al EMITIR, nunca durante el autoguardado de un borrador.
 * Es una distincion que importa: el autoguardado dispara mientras escribes,
 * asi que aprender ahi llenaria el catalogo con lo que hubiera a medio
 * teclear. Escribir "Video promocional" dejaria "vi", "vid", "video"…
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
 * Recalcula `times_used` de clientes y servicios a partir de los documentos
 * reales, en lugar de ir sumando de uno en uno.
 *
 * Un contador que se incrementa se desincroniza en cuanto algo se guarda
 * dos veces, se edita una factura ya emitida o se borra una. Recalcularlo
 * es idempotente: da igual cuantas veces se ejecute.
 *
 * Recorre las tablas crudas, no las vistas, y esta bien asi: un cliente de
 * remont solo puede estar referenciado por documentos de remont, porque la
 * factura y la ficha nacieron en la misma cuenta. Cada fila se cuenta con
 * lo suyo aunque el UPDATE pase por todas.
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
 * Cambia el estado de un documento.
 *
 * Si es la primera vez que sale de borrador, aqui es donde deja de ser
 * 'BOR-0003' y recibe su numero definitivo.
 */
export async function setStatus(id, status) {
  const actual = await queryOne(
    `SELECT number, status, kind FROM mis_documentos WHERE id = $1`,
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

  if (actual.status === 'draft' && status !== 'draft') await aprender(id)
  else await recomputarUso()

  return getFull(id)
}

/** Borra el documento; sus lineas e impuestos se van por ON DELETE CASCADE. */
export async function remove(id) {
  const cuenta = await cuentaActual()
  const r = await execute(
    `DELETE FROM invoices WHERE id = $1 AND account_id = $2`,
    [id, cuenta],
  )
  await recomputarUso()
  return r
}

/** Duplica un documento como borrador nuevo, con numero nuevo y fecha de hoy. */
export async function duplicate(id) {
  const original = await getFull(id)
  if (!original) return null
  return save({
    id: null,
    number: null,   // el duplicado nace como borrador, con su propio numero
    kind: original.kind,
    client: {
      name: original.client_name,
      email: original.client_email,
      phone: original.client_phone,
      address: original.client_address,
      tax_id: original.client_tax_id,
    },
    items: original.items,
    adjustments: original.adjustments,
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: null,
    status: 'draft',
    discount_type: original.discount_type,
    discount_value: original.discount_value,
    notes: original.notes,
    payment_details: original.payment_details,
    currency_symbol: original.currency_symbol,
    service_place: original.service_place,
    service_date_text: original.service_date_text,
    credit_terms: original.credit_terms,
    prepared_by: original.prepared_by,
    // `quote_ref` NO se copia: la referencia a la cotizacion de origen es de
    // aquel documento, no de esta copia. Un duplicado que dijera venir de la
    // misma cotizacion haria pensar que se facturo dos veces lo mismo.
  })
}
