/**
 * Dinero y cantidades — la unica fuente de verdad para convertir y formatear.
 *
 * Por que no usamos numeros decimales normales:
 *   0.1 + 0.2 === 0.30000000000000004
 * En una factura eso significa un total que no cuadra con la suma de sus
 * lineas. La solucion estandar en contabilidad es trabajar con enteros:
 *   - El dinero se guarda en CENTAVOS       (1,500.00 -> 150000)
 *   - Las cantidades en MILESIMAS           (2.5 horas -> 2500)
 * Todo lo que entra o sale de la base de datos pasa por aqui.
 */

// ---------------------------------------------------------------- DINERO

/** "1,500.50" | 1500.5 -> 150050 centavos. Entrada invalida -> 0. */
export function toCents(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * 100) : 0
  }
  if (typeof value !== 'string') return 0

  // Acepta lo que el usuario escriba: "RD$ 1,500.50", "1.500,50", "1500"
  let limpio = value.replace(/[^\d.,-]/g, '').trim()
  if (!limpio) return 0

  const ultimaComa = limpio.lastIndexOf(',')
  const ultimoPunto = limpio.lastIndexOf('.')

  if (ultimaComa > ultimoPunto) {
    // Formato europeo: 1.500,50 -> el separador decimal es la coma
    limpio = limpio.replace(/\./g, '').replace(',', '.')
  } else {
    // Formato anglosajon: 1,500.50 -> las comas son miles
    limpio = limpio.replace(/,/g, '')
  }

  const n = parseFloat(limpio)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** 150050 centavos -> 1500.5 (para mostrar en un input) */
export function fromCents(cents) {
  return (Number(cents) || 0) / 100
}

/** 150050 -> "RD$ 1,500.50" */
export function formatMoney(cents, symbol = 'RD$') {
  const n = fromCents(cents)
  const texto = Math.abs(n).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${n < 0 ? '-' : ''}${symbol} ${texto}`
}

/** 150050 -> "1,500.50" (sin simbolo, para inputs y tablas) */
export function formatAmount(cents) {
  return fromCents(cents).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ------------------------------------------------------------ CANTIDADES

/** "2.5" | 2.5 -> 2500 milesimas. Minimo 1 (0.001). */
export function toMilli(value) {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return 1000
  return Math.max(1, Math.round(n * 1000))
}

/** 2500 -> 2.5 */
export function fromMilli(milli) {
  return (Number(milli) || 0) / 1000
}

/** 2500 -> "2.5"  |  1000 -> "1"  (sin decimales inutiles) */
export function formatQty(milli) {
  const n = fromMilli(milli)
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)))
}

// -------------------------------------------------------------- CALCULOS

/** Total de una linea, redondeado al centavo. */
export function lineTotal(quantityMilli, unitPriceCents) {
  return Math.round(((Number(quantityMilli) || 0) * (Number(unitPriceCents) || 0)) / 1000)
}

/**
 * Calcula subtotal, descuento y total de una factura completa.
 * `discountValue` son centavos si el tipo es 'amount', o centesimas de
 * punto porcentual si es 'percent' (1000 = 10.00 %).
 *
 * Devuelve enteros; el descuento nunca deja el total en negativo.
 */
export function invoiceTotals(items, discountType = 'none', discountValue = 0) {
  const subtotal = items.reduce(
    (suma, it) => suma + lineTotal(it.quantity_milli, it.unit_price_cents),
    0,
  )

  let descuento = 0
  if (discountType === 'amount') {
    descuento = Math.max(0, Math.round(discountValue))
  } else if (discountType === 'percent') {
    descuento = Math.round((subtotal * discountValue) / 10000)
  }
  descuento = Math.min(descuento, subtotal)

  return {
    subtotal_cents: subtotal,
    discount_cents: descuento,
    total_cents: subtotal - descuento,
  }
}
