/**
 * Fechas. En la base se guardan siempre como 'YYYY-MM-DD' (texto ISO),
 * porque SQLite las ordena y compara correctamente en ese formato y no
 * dependen de la zona horaria del equipo.
 */

/** Hoy, en el formato que entiende la base de datos. */
export function today() {
  const d = new Date()
  // Se construye a mano para usar la fecha LOCAL. `toISOString()` convierte
  // a UTC y en Republica Dominicana (UTC-4) eso adelanta un dia a partir
  // de las 8 de la noche: una factura emitida el lunes por la noche
  // quedaria fechada el martes.
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Suma dias a una fecha ISO y devuelve otra fecha ISO. */
export function addDays(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number)
  const fecha = new Date(a, m - 1, d + dias)
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`
}

/**
 * '2026-08-23' -> '23 ago 2026'
 *
 * No se usa `toLocaleDateString` con `month: 'short'` porque el locale
 * espanol intercala un "de" ("23 ago de 2026") que en una tabla o en una
 * factura queda mal. Se arma a mano con los nombres de mes.
 */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
               'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function formatDate(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MESES[m - 1]} ${a}`
}

/** '2026-08-23' -> '23 ago' (el ano solo aparece si no es el actual) */
export function formatDateShort(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return a === new Date().getFullYear()
    ? `${d} ${MESES[m - 1]}`
    : `${d} ${MESES[m - 1]} ${a}`
}

/** Dias que faltan (positivo) o que han pasado (negativo) hasta una fecha. */
export function daysUntil(iso) {
  if (!iso) return null
  const hoy = new Date(today())
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Math.round((new Date(a, m - 1, d) - hoy) / 86400000)
}

/** 'Vence en 5 días' | 'Vencida hace 3 días' | 'Vence hoy' */
export function dueLabel(iso) {
  const dias = daysUntil(iso)
  if (dias === null) return ''
  if (dias === 0) return 'Vence hoy'
  if (dias > 0) return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`
  const pasados = Math.abs(dias)
  return `Vencida hace ${pasados} ${pasados === 1 ? 'día' : 'días'}`
}

function pad(n) {
  return String(n).padStart(2, '0')
}
