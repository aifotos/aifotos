import { lineTotal } from './money.js'

/**
 * Costeo: de lo que te cuesta a lo que cobras.
 *
 * La regla de toda esta pantalla es que el margen va SOBRE EL PRECIO DE
 * VENTA, no sobre el costo:
 *
 *     precio = costo / (1 - margen)
 *
 * Con un costo de 2.500 y un 20 %, el precio es 3.125 y ganas 625, que es
 * el 20 % de 3.125. Si en vez de dividir multiplicaras (2.500 x 1,20 =
 * 3.000) ganarias 500, y sobre el precio eso es un 16,7 %: casi un cuarto
 * menos de lo que creias. Confundir las dos cosas es el error clasico de
 * cualquier hoja de costeo, y por eso la division esta en un solo sitio.
 */

/** Los margenes que ofrece el desplegable, en centesimas de punto. */
export const MARGENES = [1500, 2000, 2500, 3000]

export const CATEGORIAS = {
  labor: { label: 'Mano de obra', corto: 'M. obra' },
  material: { label: 'Material', corto: 'Material' },
}

export const MODOS_PRECIO = {
  margin: { label: 'Por margen' },
  double: { label: 'Cobrar doble' },
  manual: { label: 'Precio fijo' },
}

/**
 * Descuento por politica, segun el tamano del presupuesto.
 *
 * Los tramos salen de la hoja de costeo, con una correccion: alli el
 * tramo pequeno daba un 20 % y los grandes un 7 %, o sea mas descuento
 * cuanto menos compras. Era un dedazo, y queda en 2 %.
 */
export const TRAMOS_DESCUENTO = [
  { hasta: 499_900, bp: 200 },      // hasta RD$ 4,999
  { hasta: 3_499_900, bp: 500 },    // hasta RD$ 34,999
  { hasta: Infinity, bp: 700 },     // de ahi en adelante
]

export function descuentoPorPolitica(brutoCents) {
  return TRAMOS_DESCUENTO.find((t) => brutoCents <= t.hasta).bp
}

/**
 * Redondea al multiplo de `paso` centavos mas cercano.
 * paso 0 o 1 = sin redondear.
 */
export function redondear(cents, paso) {
  const n = Math.round(Number(cents) || 0)
  const p = Math.round(Number(paso) || 0)
  if (p <= 1) return n
  return Math.round(n / p) * p
}

/**
 * costo / (1 - margen), en enteros.
 *
 * El tope del 99,99 % no es un capricho: al 100 % la division es por cero.
 */
export function precioPorMargen(baseCents, margenBp) {
  const resto = 10000 - Math.min(9999, Math.max(0, Math.round(margenBp) || 0))
  return Math.round((Math.max(0, baseCents) * 10000) / resto)
}

/** El margen real que deja un precio sobre una base, en centesimas de punto. */
export function margenDe(precioCents, baseCents) {
  if (precioCents <= 0) return 0
  return Math.round(((precioCents - baseCents) / precioCents) * 10000)
}

/**
 * Los dos precios de una linea y lo que dejan.
 *
 * Siempre calcula los DOS —el de empresa y el del segundo margen— aunque
 * solo uno acabe en la cotizacion. Verlos juntos es lo que convierte
 * "cuanto cobro" en una decision en vez de una corazonada.
 *
 * La entrega entra en la base. En el Excel no entraba y el numero mentia:
 * el precio de la mampara si se calculaba sobre costo + entrega, pero el
 * margen se comparaba solo contra el costo, asi que declaraba un 31,8 %
 * donde habia un 25 %. Si la entrega se paga, es costo.
 */
export function calcularLinea(linea, ajustes) {
  const base = (linea.cost_cents || 0) + (linea.delivery_cents || 0)
  const cantidad = linea.quantity_milli || 0

  let empresa
  let segundo
  if (linea.price_mode === 'manual') {
    // Un precio cerrado es cerrado para todo el mundo: no se redondea ni
    // se recalcula, que para eso se escribio a mano.
    empresa = segundo = Math.max(0, linea.manual_price_cents || 0)
  } else if (linea.price_mode === 'double') {
    // No es un margen, es un seguro contra rotura. Tampoco se redondea.
    empresa = segundo = base * 2
  } else {
    empresa = redondear(
      precioPorMargen(base, linea.margin_bp),
      ajustes.rounding_primary_cents,
    )
    segundo = redondear(
      precioPorMargen(base, ajustes.margin_secondary_bp),
      ajustes.rounding_secondary_cents,
    )
  }

  const precio = ajustes.price_mode === 'residential' ? segundo : empresa

  return {
    base_cents: base,
    precio_empresa_cents: empresa,
    precio_segundo_cents: segundo,
    precio_cents: precio,
    margen_bp: margenDe(precio, base),
    costo_total_cents: lineTotal(cantidad, base),
    total_cents: lineTotal(cantidad, precio),
    // Solo cuando se sabe. NULL no es cero: "todavia no lo he comprado"
    // y "me salio gratis" no son lo mismo.
    real_total_cents:
      linea.real_cost_cents == null ? null : lineTotal(cantidad, linea.real_cost_cents),
  }
}

/** Totales del costeo entero, con su descuento y su variacion. */
export function calcularCosteo(lineas, ajustes) {
  const detalle = lineas.map((l) => ({ ...l, calc: calcularLinea(l, ajustes) }))

  const costo_cents = detalle.reduce((s, l) => s + l.calc.costo_total_cents, 0)
  const bruto_cents = detalle.reduce((s, l) => s + l.calc.total_cents, 0)

  const descuento_bp =
    ajustes.discount_mode === 'policy'
      ? descuentoPorPolitica(bruto_cents)
      : ajustes.discount_mode === 'manual'
        ? Math.min(10000, Math.max(0, ajustes.discount_bp || 0))
        : 0
  const descuento_cents = Math.round((bruto_cents * descuento_bp) / 10000)
  const total_cents = bruto_cents - descuento_cents

  // La variacion solo mira las lineas cuyo costo real se conoce; mezclar
  // las demas daria un ahorro falso del 100 % por cada linea sin dato.
  const conReal = detalle.filter((l) => l.calc.real_total_cents != null)
  const costo_previsto_cents = conReal.reduce((s, l) => s + l.calc.costo_total_cents, 0)
  const costo_real_cents = conReal.reduce((s, l) => s + l.calc.real_total_cents, 0)

  return {
    lineas: detalle,
    costo_cents,
    bruto_cents,
    descuento_bp,
    descuento_cents,
    total_cents,
    ganancia_cents: total_cents - costo_cents,
    margen_bp: margenDe(total_cents, costo_cents),
    // Variacion
    n_con_real: conReal.length,
    costo_previsto_cents,
    costo_real_cents,
    variacion_cents: costo_real_cents - costo_previsto_cents,
    variacion_bp:
      costo_previsto_cents > 0
        ? Math.round(((costo_real_cents - costo_previsto_cents) / costo_previsto_cents) * 10000)
        : 0,
  }
}

/** 2000 -> '20 %'  |  2012 -> '20.1 %' */
export function formatoMargen(bp) {
  const n = (Number(bp) || 0) / 100
  return `${Number.isInteger(n) ? n : n.toFixed(1)} %`
}
