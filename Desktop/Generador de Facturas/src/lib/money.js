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

// ------------------------------------------------- IMPUESTOS Y RETENCIONES

/**
 * Aplica una regla de impuesto o retencion y devuelve su importe en centavos.
 *
 *   base 'subtotal'  un % del importe bruto ya descontado
 *   base 'taxes'     un % de los impuestos sumados (asi se dice "me retienen
 *                    el 100 % del ITBIS" sin tener que calcularlo a mano)
 *   base 'fixed'     un importe fijo; ahi `rate_bp` son centavos, no un %
 */
export function adjustmentAmount(regla, baseCents, taxCents) {
  const tasa = Number(regla.rate_bp) || 0
  if (regla.base === 'fixed') return Math.max(0, Math.round(tasa))
  const sobre = regla.base === 'taxes' ? taxCents : baseCents
  return Math.round((sobre * tasa) / 10000)
}

/**
 * Totales completos de un documento, con impuestos y retenciones.
 *
 * El orden no es un detalle: los impuestos se calculan primero porque las
 * retenciones pueden apoyarse en ellos, y no al reves. Es exactamente como
 * se lee el pie de la factura de arriba abajo:
 *
 *   Importe bruto      suma de las lineas
 *   − Descuento
 *   = Base imponible
 *   + Impuestos        ITBIS 18 %…
 *   = Subtotal
 *   − Retenciones      ITBIS retenido, ISR 2 %…
 *   = Importe neto     lo que el cliente paga de verdad
 *
 * Devuelve tambien `ajustes`, cada regla con su importe ya calculado: es la
 * misma lista que se pinta en el documento y la que se guarda en la base,
 * asi que lo que ves impreso y lo que queda guardado no pueden discrepar.
 */
export function documentTotals(items, discountType = 'none', discountValue = 0, adjustments = []) {
  const { subtotal_cents, discount_cents } = invoiceTotals(items, discountType, discountValue)
  const base = subtotal_cents - discount_cents

  const impuestos = []
  let tax_cents = 0
  for (const a of adjustments) {
    if (a.kind !== 'tax') continue
    // Un impuesto con base 'taxes' se apoya en los impuestos que ya se han
    // sumado ANTES que el, no en el total final: si no, dependeria de si
    // mismo.
    const amount_cents = adjustmentAmount(a, base, tax_cents)
    tax_cents += amount_cents
    impuestos.push({ ...a, amount_cents })
  }

  const retenciones = []
  let retention_cents = 0
  for (const a of adjustments) {
    if (a.kind !== 'retention') continue
    const amount_cents = adjustmentAmount(a, base, tax_cents)
    retention_cents += amount_cents
    retenciones.push({ ...a, amount_cents })
  }

  return {
    subtotal_cents,
    discount_cents,
    base_cents: base,
    tax_cents,
    retention_cents,
    // Lo que se cobra. Sigue llamandose total_cents porque es lo que suma
    // el panel, y lo que el panel debe sumar es el importe neto.
    total_cents: base + tax_cents - retention_cents,
    impuestos,
    retenciones,
    ajustes: [...impuestos, ...retenciones],
  }
}
