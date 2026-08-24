import { queryOne, execute } from './index.js'

/**
 * Ajustes del emisor: tus datos, tu logo y la numeracion de las facturas.
 * Siempre es una sola fila, con id = 1.
 */

export function get() {
  return queryOne(`SELECT * FROM settings WHERE id = 1`)
}

export async function update(datos) {
  await execute(
    `UPDATE settings SET
       business_name      = $1,
       tax_id             = $2,
       email              = $3,
       phone              = $4,
       address            = $5,
       website            = $6,
       logo_data_url      = $7,
       currency_symbol    = $8,
       invoice_prefix     = $9,
       payment_terms_days = $10,
       default_notes      = $11,
       payment_details    = $12,
       updated_at         = datetime('now')
     WHERE id = 1`,
    [
      datos.business_name ?? '',
      datos.tax_id ?? '',
      datos.email ?? '',
      datos.phone ?? '',
      datos.address ?? '',
      datos.website ?? '',
      datos.logo_data_url ?? null,
      datos.currency_symbol ?? 'RD$',
      datos.invoice_prefix ?? 'FAC-',
      datos.payment_terms_days ?? 15,
      datos.default_notes ?? '',
      datos.payment_details ?? '',
    ],
  )
  return get()
}

/**
 * Siguiente numero disponible, SIN consumirlo.
 *
 * Se usa para mostrar "FAC-0008" mientras escribes una factura que todavia
 * no has guardado. El numero solo se reserva de verdad al guardar
 * (ver `consumeNumber`), para no dejar huecos si cierras sin guardar.
 */
export async function peekNextNumber() {
  const s = await get()
  return formatNumber(s.invoice_prefix, s.next_invoice_number)
}

/**
 * Reserva el siguiente numero de factura y avanza el contador.
 *
 * El `WHERE next_invoice_number = $1` es un seguro: si otra parte de la app
 * reservo un numero entre la lectura y la escritura, este UPDATE no afecta
 * ninguna fila y volvemos a intentarlo con el valor nuevo. Asi nunca salen
 * dos facturas con el mismo numero.
 *
 * Solo se llama al EMITIR. Los borradores usan `consumeDraftNumber`, para
 * que un borrador que nunca llegas a emitir no deje un hueco permanente
 * en la numeracion fiscal.
 */
export async function consumeNumber() {
  return reservar('next_invoice_number', (s) => s.invoice_prefix)
}

/**
 * Reserva el siguiente numero de cotizacion: 'COT-0003'.
 *
 * Secuencia aparte de la fiscal: cotizar no puede gastar correlativo de
 * facturas. Y al reves que las facturas, aqui un hueco no importa —
 * la numeracion de presupuestos no la mira Hacienda.
 */
export async function consumeQuoteNumber() {
  return reservar('next_quote_number', () => PREFIJO_COTIZACION)
}

export const PREFIJO_COTIZACION = 'COT-'

/**
 * Numero interno de un borrador: 'BOR-0003'.
 *
 * Existe solo para cumplir la restriccion UNIQUE de `invoices.number`.
 * En pantalla un borrador se muestra como "Borrador", nunca con este
 * codigo, y al emitirlo se sustituye por el numero real.
 */
export async function consumeDraftNumber() {
  return reservar('next_draft_number', () => PREFIJO_BORRADOR)
}

export const PREFIJO_BORRADOR = 'BOR-'

/**
 * ¿Este numero es el de un borrador sin emitir?
 *
 * Lo comparten facturas y cotizaciones: mientras es borrador, un documento
 * usa 'BOR-0003' y solo al emitirlo o enviarlo recibe su 'FAC-' o 'COT-'.
 */
export function esBorrador(number) {
  return !number || String(number).startsWith(PREFIJO_BORRADOR)
}

async function reservar(columna, prefijoDe) {
  for (let intento = 0; intento < 5; intento++) {
    const s = await get()
    const actual = s[columna]
    const { rowsAffected } = await execute(
      `UPDATE settings SET ${columna} = $1 WHERE id = 1 AND ${columna} = $2`,
      [actual + 1, actual],
    )
    if (rowsAffected > 0) return formatNumber(prefijoDe(s), actual)
  }
  throw new Error('No se pudo reservar un numero')
}

/** 'FAC-' + 7 -> 'FAC-0007' (4 digitos minimo, crece solo si hace falta) */
export function formatNumber(prefix, n) {
  return `${prefix}${String(n).padStart(4, '0')}`
}
