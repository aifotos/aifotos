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
 * Reserva el siguiente numero y avanza el contador.
 *
 * El `WHERE next_invoice_number = $1` es un seguro: si otra parte de la app
 * reservo un numero entre la lectura y la escritura, este UPDATE no afecta
 * ninguna fila y volvemos a intentarlo con el valor nuevo. Asi nunca salen
 * dos facturas con el mismo numero.
 */
export async function consumeNumber() {
  for (let intento = 0; intento < 5; intento++) {
    const s = await get()
    const actual = s.next_invoice_number
    const { rowsAffected } = await execute(
      `UPDATE settings SET next_invoice_number = $1
       WHERE id = 1 AND next_invoice_number = $2`,
      [actual + 1, actual],
    )
    if (rowsAffected > 0) return formatNumber(s.invoice_prefix, actual)
  }
  throw new Error('No se pudo reservar un numero de factura')
}

/** 'FAC-' + 7 -> 'FAC-0007' (4 digitos minimo, crece solo si hace falta) */
export function formatNumber(prefix, n) {
  return `${prefix}${String(n).padStart(4, '0')}`
}
