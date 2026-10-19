import { query, queryOne, execute, atomico, cuentaActual } from './index.js'
import { calcularCosteo } from '../lib/costeo.js'
import * as settings from './settings.js'
import * as clients from './clients.js'
import * as quotes from './quotes.js'
import * as finance from './finance.js'
import { today } from '../lib/dates.js'

/**
 * Costeos.
 *
 * Un costeo es un documento interno: cabecera y lineas, como una factura,
 * pero con los numeros al reves — parte de lo que pagas y llega a lo que
 * cobras. Nunca se imprime y nunca sale de aqui.
 *
 * Se lee por la vista `mis_costeos`, filtrada por la sesion, igual que
 * todo lo demas.
 */

export const PREFIJO = 'COS-'

// ------------------------------------------------------------- CONSULTAS

export function list({ search = '', limit = 200 } = {}) {
  const t = search.trim().toLowerCase()
  return query(
    `SELECT c.*,
            (SELECT COUNT(*) FROM costing_lines WHERE costing_id = c.id) AS line_count
     FROM mis_costeos c
     WHERE ($1 = '' OR lower(c.number) LIKE $2 OR lower(c.title) LIKE $2
            OR lower(c.client_name) LIKE $2)
     ORDER BY c.issue_date DESC, c.id DESC
     LIMIT $3`,
    [t, `%${t}%`, limit],
  )
}

export async function getFull(id) {
  const costeo = await queryOne(`SELECT * FROM mis_costeos WHERE id = $1`, [id])
  if (!costeo) return null
  const lineas = await query(
    `SELECT * FROM costing_lines WHERE costing_id = $1 ORDER BY position ASC, id ASC`,
    [id],
  )
  return { ...costeo, lineas }
}

/** Resumen para la cabecera del listado. */
export function summary() {
  return queryOne(
    `SELECT COUNT(*)                                        AS n,
            COUNT(quote_id)                                 AS n_convertidos,
            COALESCE(SUM(total_cents), 0)                   AS valor,
            COALESCE(SUM(total_cents - cost_cents), 0)      AS ganancia
     FROM mis_costeos`,
  )
}

// -------------------------------------------------------------- GUARDADO

/**
 * Guarda el costeo entero en un solo lote atomico.
 *
 * Los totales se recalculan aqui a partir de las lineas: nunca se confia
 * en los que venga del formulario. Es la misma regla que en las facturas
 * y por el mismo motivo — un total que llega de la pantalla es un total
 * que alguien pudo dejar a medias.
 */
export async function save(borrador) {
  const cuenta = await cuentaActual()
  const ajustes = await settings.get()

  const lineas = (borrador.lineas ?? []).filter(
    (l) => String(l.description ?? '').trim() !== '' || l.cost_cents > 0,
  )

  const totales = calcularCosteo(lineas, {
    margin_secondary_bp: ajustes.margin_secondary_bp,
    rounding_primary_cents: ajustes.rounding_primary_cents,
    rounding_secondary_cents: ajustes.rounding_secondary_cents,
    price_mode: borrador.price_mode ?? 'business',
    discount_mode: borrador.discount_mode ?? 'none',
    discount_bp: borrador.discount_bp ?? 0,
  })

  let number = borrador.number ?? null
  if (!number) number = await reservarNumero()

  const cliente = borrador.client_name?.trim()
    ? await clients.getByName(borrador.client_name)
    : null

  // Las lineas se enganchan por (cuenta, numero) y no por el id: dentro de
  // un lote no se puede leer el id que acaba de generar el INSERT anterior.
  const porNumero = `(SELECT id FROM costings WHERE account_id = ? AND number = ?)`
  const clave = [cuenta, number]

  const campos = [
    borrador.title ?? '',
    borrador.issue_date ?? today(),
    cliente?.id ?? null,
    borrador.client_name ?? '',
    borrador.supplier ?? '',
    borrador.supplier_ref ?? '',
    borrador.price_mode ?? 'business',
    borrador.discount_mode ?? 'none',
    totales.descuento_bp,
    totales.costo_cents,
    totales.bruto_cents,
    totales.descuento_cents,
    totales.total_cents,
    borrador.notes ?? '',
  ]

  const sentencias = []
  if (borrador.id) {
    sentencias.push({
      sql: `UPDATE costings SET
              title = ?, issue_date = ?, client_id = ?, client_name = ?,
              supplier = ?, supplier_ref = ?, price_mode = ?,
              discount_mode = ?, discount_bp = ?,
              cost_cents = ?, gross_cents = ?, discount_cents = ?, total_cents = ?,
              notes = ?
            WHERE id = ? AND account_id = ?`,
      params: [...campos, borrador.id, cuenta],
    })
  } else {
    sentencias.push({
      sql: `INSERT INTO costings
              (account_id, number, title, issue_date, client_id, client_name,
               supplier, supplier_ref, price_mode, discount_mode, discount_bp,
               cost_cents, gross_cents, discount_cents, total_cents, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [cuenta, number, ...campos],
    })
  }

  sentencias.push({
    sql: `DELETE FROM costing_lines WHERE costing_id = ${porNumero}`,
    params: [...clave],
  })

  lineas.forEach((l, i) => {
    sentencias.push({
      sql: `INSERT INTO costing_lines
              (costing_id, position, category, description, supplier, sku,
               quantity_milli, cost_cents, delivery_cents, price_mode,
               margin_bp, manual_price_cents, double_reason, real_cost_cents)
            VALUES (${porNumero}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        ...clave,
        i,
        l.category ?? 'material',
        String(l.description ?? '').trim(),
        String(l.supplier ?? '').trim(),
        String(l.sku ?? '').trim(),
        l.quantity_milli ?? 1000,
        l.cost_cents ?? 0,
        l.delivery_cents ?? 0,
        l.price_mode ?? 'margin',
        l.margin_bp ?? 2000,
        l.manual_price_cents ?? 0,
        String(l.double_reason ?? '').trim(),
        l.real_cost_cents ?? null,
      ],
    })
  })

  await atomico(sentencias)

  const guardado = await queryOne(
    `SELECT id FROM costings WHERE account_id = $1 AND number = $2`,
    [cuenta, number],
  )
  if (!guardado) throw new Error(`No se pudo guardar ${number}`)
  return getFull(guardado.id)
}

/**
 * Reserva el siguiente numero. Mismo UPDATE condicional que la numeracion
 * de facturas: si otro guardado se le adelanta, no afecta ninguna fila y
 * se reintenta con el valor nuevo.
 */
async function reservarNumero() {
  const cuenta = await cuentaActual()
  for (let intento = 0; intento < 5; intento++) {
    const s = await settings.get()
    const actual = s.next_costing_number
    const { rowsAffected } = await execute(
      `UPDATE settings SET next_costing_number = $1
        WHERE account_id = $2 AND next_costing_number = $3`,
      [actual + 1, cuenta, actual],
    )
    if (rowsAffected > 0) return settings.formatNumber(PREFIJO, actual, 4)
  }
  throw new Error('No se pudo reservar un número de costeo')
}

export async function remove(id) {
  const cuenta = await cuentaActual()
  return execute(`DELETE FROM costings WHERE id = $1 AND account_id = $2`, [id, cuenta])
}

/** Un costeo nuevo con las mismas lineas. Las obras se repiten mucho. */
export async function duplicate(id) {
  const original = await getFull(id)
  if (!original) return null
  return save({
    ...original,
    id: null,
    number: null,
    title: `${original.title || original.number} (copia)`.trim(),
    issue_date: today(),
    // El costo real y el enlace a la cotizacion son de AQUEL costeo, no de
    // la copia. Arrastrarlos haria creer que esta copia ya se compro.
    lineas: original.lineas.map((l) => ({ ...l, id: null, real_cost_cents: null })),
  })
}

// ------------------------------------------------------------ CONVERSION

/**
 * Genera la cotizacion que se le ensena al cliente.
 *
 * Al cliente le llega UNA linea por concepto, con su precio de venta.
 * Nada del costo, del margen ni del motivo del doble cruza esta funcion:
 * son datos internos, y la cotizacion se construye desde cero con los
 * precios ya calculados, no copiando la linea del costeo.
 *
 * El costeo no se borra ni se transforma: queda enlazado, como una
 * cotizacion convertida en factura, y ese enlace es ademas el seguro que
 * impide generar dos cotizaciones del mismo trabajo.
 *
 * @param {boolean} registrarCostos  deja ademas los costos como previstos
 *        en «Costos y gastos», para que luego la variacion contra el gasto
 *        real salga sola.
 */
export async function convertirEnCotizacion(id, { registrarCostos = true } = {}) {
  const costeo = await getFull(id)
  if (!costeo) throw new Error('El costeo no existe')
  if (costeo.quote_id != null) {
    throw new Error('Este costeo ya generó una cotización')
  }
  if (costeo.lineas.length === 0) {
    throw new Error('El costeo no tiene ninguna línea')
  }

  const ajustes = await settings.get()
  const totales = calcularCosteo(costeo.lineas, {
    margin_secondary_bp: ajustes.margin_secondary_bp,
    rounding_primary_cents: ajustes.rounding_primary_cents,
    rounding_secondary_cents: ajustes.rounding_secondary_cents,
    price_mode: costeo.price_mode,
    discount_mode: costeo.discount_mode,
    discount_bp: costeo.discount_bp,
  })

  const cot = await quotes.save({
    id: null,
    number: null,
    client: {
      name: costeo.client_name,
      email: '',
      phone: '',
      address: '',
      tax_id: '',
    },
    items: totales.lineas.map((l) => ({
      service_id: null,
      description: l.description,
      detail: '',
      quantity_milli: l.quantity_milli,
      unit: 'unidad',
      unit_price_cents: l.calc.precio_cents,
    })),
    adjustments: [],
    issue_date: today(),
    due_date: quotes.validaHastaPorDefecto(),
    // Nace como borrador: una cotizacion se revisa antes de mandarla, y
    // crearla ya «enviada» gastaria el numero de algo que aun no ha salido.
    status: 'draft',
    discount_type: totales.descuento_bp > 0 ? 'percent' : 'none',
    discount_value: totales.descuento_bp,
    notes: ajustes.default_notes ?? '',
    payment_details: ajustes.payment_details ?? '',
    currency_symbol: ajustes.currency_symbol ?? 'RD$',
    service_place: costeo.title ?? '',
    prepared_by: ajustes.default_user ?? '',
  })

  try {
    await execute(`UPDATE costings SET quote_id = $1 WHERE id = $2`, [cot.id, id])
  } catch (error) {
    // Sin el enlace, el costeo volveria a ser convertible y acabarias con
    // dos cotizaciones del mismo trabajo. Es preferible deshacer.
    await execute(`DELETE FROM invoices WHERE id = $1`, [cot.id])
    throw error
  }

  if (registrarCostos) {
    // Se apuntan como PREVISTOS, no como reales: todavia no se ha pagado
    // nada. Cuando se pague, se registra el gasto real y la comparacion
    // que ya existe en «Costos y gastos» se llena sola.
    for (const l of totales.lineas) {
      await finance.saveCost({
        document_id: cot.id,
        project: costeo.title || costeo.number,
        description: l.description,
        // Siempre 'cost'. En «Costos y gastos», `cost` es el costo
        // directo de un trabajo y `expense` el gasto del negocio (alquiler,
        // seguros). Todo lo que sale de un costeo es lo primero, tambien la
        // mano de obra: se paga POR esa obra. Mandarla a `expense` la
        // sacaria del calculo de rentabilidad de la obra, que es
        // exactamente para lo que se apunta.
        category: 'cost',
        stage: 'planned',
        incurred_on: today(),
        quantity_milli: l.quantity_milli,
        unit_price_cents: l.calc.base_cents,
        supplier: l.supplier || costeo.supplier || '',
        notes: `Previsto desde el costeo ${costeo.number}`,
      }).catch(() => {
        // Que falle un apunte de costos no puede tumbar la cotizacion, que
        // es lo que el usuario vino a buscar. Se sigue sin el.
      })
    }
  }

  return cot
}
