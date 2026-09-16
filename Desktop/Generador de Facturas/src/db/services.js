import { query, queryOne, execute, nameKey, cuentaActual } from './index.js'

/**
 * Catalogo de productos y servicios de la cuenta abierta.
 *
 * Como los clientes: se lee por la vista `mis_servicios`, asi que cada
 * negocio tiene su propio catalogo. Los servicios de fotografia de aifotos
 * y las partidas de obra de remont no se mezclan nunca.
 */

/** Sugerencias para el autocompletado de la descripcion de una linea. */
export function search(termino = '', limite = 8) {
  const t = nameKey(termino)
  if (!t) {
    return query(
      `SELECT * FROM mis_servicios
       WHERE archived = 0
       ORDER BY times_used DESC, last_used_at DESC, name ASC
       LIMIT $1`,
      [limite],
    )
  }
  return query(
    `SELECT * FROM mis_servicios
     WHERE archived = 0 AND (name_key LIKE $1 OR lower(description) LIKE $1)
     ORDER BY
       CASE WHEN name_key LIKE $2 THEN 0 ELSE 1 END,
       times_used DESC, name ASC
     LIMIT $3`,
    [`%${t}%`, `${t}%`, limite],
  )
}

export function listAll({ includeArchived = false } = {}) {
  return query(
    `SELECT * FROM mis_servicios
     WHERE ($1 = 1 OR archived = 0)
     ORDER BY times_used DESC, name ASC`,
    [includeArchived ? 1 : 0],
  )
}

export function getById(id) {
  return queryOne(`SELECT * FROM mis_servicios WHERE id = $1`, [id])
}

export function getByName(name) {
  return queryOne(`SELECT * FROM mis_servicios WHERE name_key = $1`, [nameKey(name)])
}

/**
 * Guarda en silencio un servicio escrito en una factura.
 *
 * Diferencia importante con los clientes: el precio SI se actualiza al
 * ultimo que usaste. Si cobras una sesion a 15,000 y el mes que viene la
 * facturas a 18,000, el catalogo debe aprender el precio nuevo — es el que
 * quieres que te sugiera la proxima vez.
 */
export async function upsertByName({ name, description = '', unit_price_cents = 0, unit = 'unidad' }) {
  const limpio = String(name ?? '').trim()
  if (!limpio) return null

  const key = nameKey(limpio)
  const existente = await queryOne(`SELECT * FROM mis_servicios WHERE name_key = $1`, [key])

  if (!existente) {
    const { lastInsertId } = await execute(
      `INSERT INTO services (account_id, name, name_key, description,
                             unit_price_cents, unit, times_used, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, datetime('now'))`,
      [await cuentaActual(), limpio, key, description, unit_price_cents, unit],
    )
    return getById(lastInsertId)
  }

  await execute(
    `UPDATE services SET
       name             = $1,
       description      = COALESCE(NULLIF(description, ''), $2),
       unit_price_cents = $3,
       unit             = $4,
       times_used       = times_used + 1,
       last_used_at     = datetime('now'),
       archived         = 0
     WHERE id = $5`,
    [limpio, description, unit_price_cents, unit, existente.id],
  )
  return getById(existente.id)
}

/** Edicion explicita desde la pantalla de Servicios. */
export async function update(id, datos) {
  await execute(
    `UPDATE services SET
       name = $1, name_key = $2, description = $3,
       unit_price_cents = $4, unit = $5
     WHERE id = $6 AND account_id = $7`,
    [
      datos.name,
      nameKey(datos.name),
      datos.description ?? '',
      datos.unit_price_cents ?? 0,
      datos.unit ?? 'unidad',
      id,
      await cuentaActual(),
    ],
  )
  return getById(id)
}

export function archive(id) {
  return execute(`UPDATE services SET archived = 1 WHERE id = $1`, [id])
}

export function unarchive(id) {
  return execute(`UPDATE services SET archived = 0 WHERE id = $1`, [id])
}
