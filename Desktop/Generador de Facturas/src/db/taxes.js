import { query, queryOne, execute, nameKey, cuentaActual } from './index.js'

/**
 * Catalogo de impuestos y retenciones de la cuenta abierta.
 *
 * No es una casilla fija de "cobrar ITBIS si/no". Son reglas que tu creas
 * —nombre, tipo y tasa— y aplicas al documento que las necesita: un cliente
 * residencial no lleva ninguna y una empresa que retiene el ITBIS lleva
 * tres. Por eso viven en una tabla y no en una constante del codigo.
 *
 * Como el resto de catalogos, se leen por una vista filtrada por la sesion:
 * las reglas de remont no existen para aifotos.
 */

/** Un impuesto SUMA al importe; una retencion RESTA. */
export const TIPOS = {
  tax: { label: 'Impuesto', signo: '+', ayuda: 'Se suma al importe bruto' },
  retention: { label: 'Retención', signo: '−', ayuda: 'Se resta del subtotal' },
}

/** Sobre que se calcula la tasa. */
export const BASES = {
  subtotal: {
    label: 'Del importe bruto',
    ayuda: 'Sobre las líneas, ya descontado el descuento',
  },
  taxes: {
    label: 'De los impuestos',
    ayuda: 'Para retenciones del ITBIS: “me retienen el 100 % del impuesto”',
  },
  fixed: {
    label: 'Importe fijo',
    ayuda: 'Una cantidad concreta, sin porcentaje',
  },
}

export function listar({ includeArchived = false } = {}) {
  return query(
    `SELECT * FROM mis_impuestos
      WHERE ($1 = 1 OR archived = 0)
      ORDER BY archived ASC, position ASC, id ASC`,
    [includeArchived ? 1 : 0],
  )
}

export function getById(id) {
  return queryOne(`SELECT * FROM mis_impuestos WHERE id = $1`, [id])
}

export async function crear({ name, kind, base = 'subtotal', rate_bp = 0 }) {
  const limpio = String(name ?? '').trim()
  if (!limpio) throw new Error('La regla necesita un nombre')
  if (!TIPOS[kind]) throw new Error(`Tipo "${kind}" no válido`)
  if (!BASES[base]) throw new Error(`Base "${base}" no válida`)

  const cuenta = await cuentaActual()
  const ultima = await queryOne(
    `SELECT COALESCE(MAX(position), -1) AS n FROM mis_impuestos`,
  )
  const { lastInsertId } = await execute(
    `INSERT INTO tax_rules (account_id, name, name_key, kind, base, rate_bp, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [cuenta, limpio, nameKey(limpio), kind, base, Math.max(0, Math.round(rate_bp)), ultima.n + 1],
  )
  return getById(lastInsertId)
}

/**
 * Edita una regla.
 *
 * Cambiarla NO reescribe las facturas ya emitidas: cada documento guarda su
 * propia copia de la regla con la tasa que tenia ese dia (ver
 * `invoice_adjustments` en la migracion 004). Si el ISR sube al 3 %, las
 * facturas del ano pasado siguen imprimiendo el 2 % con el que se emitieron,
 * que es lo que el cliente pago y lo que dice su comprobante.
 */
export async function actualizar(id, { name, kind, base, rate_bp }) {
  const limpio = String(name ?? '').trim()
  if (!limpio) throw new Error('La regla necesita un nombre')
  await execute(
    `UPDATE tax_rules SET name = $1, name_key = $2, kind = $3, base = $4, rate_bp = $5
      WHERE id = $6`,
    [limpio, nameKey(limpio), kind, base, Math.max(0, Math.round(rate_bp)), id],
  )
  return getById(id)
}

/** Archiva en lugar de borrar: las facturas que la usaron siguen enteras. */
export function archivar(id) {
  return execute(`UPDATE tax_rules SET archived = 1 WHERE id = $1`, [id])
}

export function desarchivar(id) {
  return execute(`UPDATE tax_rules SET archived = 0 WHERE id = $1`, [id])
}

/** Los ajustes aplicados a un documento, en orden. */
export function deDocumento(invoiceId) {
  return query(
    `SELECT * FROM invoice_adjustments WHERE invoice_id = $1 ORDER BY position ASC, id ASC`,
    [invoiceId],
  )
}

/** 1800 -> '18 %'  |  10000 -> '100 %'  |  fijo -> '' */
export function formatoTasa(regla) {
  if (regla.base === 'fixed') return ''
  const n = (Number(regla.rate_bp) || 0) / 100
  return `${Number.isInteger(n) ? n : parseFloat(n.toFixed(2))} %`
}
