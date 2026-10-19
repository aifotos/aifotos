import { queryOne, execute, cuentaActual } from './index.js'

/**
 * Ajustes del emisor: tus datos, tu logo, tus colores y tu numeracion.
 *
 * Hay una fila por cuenta. La lectura va por la vista `mis_ajustes`, que
 * ya filtra por la sesion abierta, asi que aqui no hace falta acordarse de
 * nada: si has entrado como remont, `get()` devuelve los ajustes de remont
 * y no existe forma de que devuelva los del otro negocio.
 */

/** Devuelve los ajustes de la cuenta abierta, o null si no hay sesion. */
export function get() {
  return queryOne(`SELECT * FROM mis_ajustes`)
}

const CAMPOS = [
  'business_name', 'tax_id', 'email', 'phone', 'address', 'website',
  'logo_data_url', 'accent_color', 'currency_symbol', 'invoice_prefix',
  'number_padding', 'next_invoice_number', 'payment_terms_days',
  'default_notes', 'payment_details', 'default_user',
  'margin_labor_bp', 'margin_material_bp', 'margin_secondary_bp',
  'rounding_primary_cents', 'rounding_secondary_cents',
]

export async function update(datos) {
  const cuenta = await cuentaActual()
  const valores = [
    datos.business_name ?? '',
    datos.tax_id ?? '',
    datos.email ?? '',
    datos.phone ?? '',
    datos.address ?? '',
    datos.website ?? '',
    // Cadena vacia y NULL significan lo mismo aqui —sin logo— y conviene
    // que la base guarde solo una de las dos formas.
    datos.logo_data_url || null,
    datos.accent_color || '#F5C851',
    datos.currency_symbol ?? 'RD$',
    datos.invoice_prefix ?? '',
    Math.min(9, Math.max(1, Number(datos.number_padding) || 4)),
    Math.max(1, Number(datos.next_invoice_number) || 1),
    Math.max(0, Number(datos.payment_terms_days) || 0),
    datos.default_notes ?? '',
    datos.payment_details ?? '',
    datos.default_user ?? '',
    // Los margenes se topan en 99,99 %: al 100 % la formula del precio
    // (costo / (1 - margen)) seria una division por cero.
    margen(datos.margin_labor_bp, 2000),
    margen(datos.margin_material_bp, 2000),
    margen(datos.margin_secondary_bp, 3000),
    Math.max(0, Number(datos.rounding_primary_cents) || 0),
    Math.max(0, Number(datos.rounding_secondary_cents) || 0),
  ]
  await execute(
    `UPDATE settings SET
       ${CAMPOS.map((c, i) => `${c} = $${i + 1}`).join(', ')},
       updated_at = datetime('now')
     WHERE account_id = $${CAMPOS.length + 1}`,
    [...valores, cuenta],
  )
  return get()
}

function margen(valor, porDefecto) {
  const n = Math.round(Number(valor))
  if (!Number.isFinite(n)) return porDefecto
  return Math.min(9999, Math.max(0, n))
}

/**
 * Siguiente numero disponible, SIN consumirlo.
 *
 * Se usa para mostrar "FAC-0008" mientras escribes una factura que todavia
 * no has guardado. El numero solo se reserva de verdad al emitir.
 */
export async function peekNextNumber() {
  const s = await get()
  return formatNumber(s.invoice_prefix, s.next_invoice_number, s.number_padding)
}

/**
 * Reserva el siguiente numero de factura y avanza el contador.
 *
 * El `WHERE next_invoice_number = $2` es un seguro: si otra parte de la app
 * reservo un numero entre la lectura y la escritura, este UPDATE no afecta
 * ninguna fila y volvemos a intentarlo con el valor nuevo. Asi nunca salen
 * dos facturas con el mismo numero.
 *
 * Cada cuenta lleva su propia serie, y son independientes: que remont vaya
 * por la 00025 no adelanta la numeracion de aifotos ni al reves.
 */
export async function consumeNumber() {
  return reservar('next_invoice_number', (s) => s.invoice_prefix, (s) => s.number_padding)
}

/**
 * Reserva el siguiente numero de cotizacion: 'COT-0003'.
 *
 * Secuencia aparte de la fiscal: cotizar no puede gastar correlativo de
 * facturas.
 */
export async function consumeQuoteNumber() {
  return reservar('next_quote_number', () => PREFIJO_COTIZACION)
}

export const PREFIJO_COTIZACION = 'COT-'

/**
 * Numero interno de un borrador: 'BOR-0003'.
 *
 * Existe solo para cumplir la restriccion UNIQUE de `invoices`. En pantalla
 * un borrador se muestra como "Borrador", nunca con este codigo, y al
 * emitirlo se sustituye por el numero real.
 */
export async function consumeDraftNumber() {
  return reservar('next_draft_number', () => PREFIJO_BORRADOR)
}

export const PREFIJO_BORRADOR = 'BOR-'

/**
 * ¿Este numero es el de un borrador sin emitir?
 *
 * Lo comparten facturas y cotizaciones: mientras es borrador, un documento
 * usa 'BOR-0003' y solo al emitirlo o enviarlo recibe su numero real.
 */
export function esBorrador(number) {
  return !number || String(number).startsWith(PREFIJO_BORRADOR)
}

async function reservar(columna, prefijoDe, anchoDe = () => 4) {
  const cuenta = await cuentaActual()
  for (let intento = 0; intento < 5; intento++) {
    const s = await get()
    if (!s) throw new Error('No hay ninguna sesión abierta')
    const actual = s[columna]
    const { rowsAffected } = await execute(
      `UPDATE settings SET ${columna} = $1
        WHERE account_id = $2 AND ${columna} = $3`,
      [actual + 1, cuenta, actual],
    )
    if (rowsAffected > 0) return formatNumber(prefijoDe(s), actual, anchoDe(s))
  }
  throw new Error('No se pudo reservar un numero')
}

/**
 * 'FAC-' + 7 -> 'FAC-0007'.  '' + 24 con ancho 5 -> '00024'.
 *
 * El ancho es de cada cuenta: aifotos numera 'FAC-0001' y remont '00025',
 * que es como venia numerando antes de esta app.
 */
export function formatNumber(prefix, n, ancho = 4) {
  return `${prefix ?? ''}${String(n).padStart(Math.min(9, Math.max(1, ancho || 4)), '0')}`
}
