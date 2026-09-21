import { query, queryOne, execute, nameKey, cuentaActual } from './index.js'

/**
 * Clientes de la cuenta abierta.
 *
 * Todas las lecturas van por la vista `mis_clientes`, que filtra por la
 * sesion: los clientes de aifotos y los de remont son dos agendas que no
 * se ven entre si, y no por un `WHERE` que haya que acordarse de escribir,
 * sino porque la consulta no alcanza las otras filas.
 *
 * Las escrituras si tienen que decir de quien es la ficha, y para eso esta
 * `cuentaActual()`.
 */

/** Lista para el autocompletado: los mas usados primero. */
export function search(termino = '', limite = 8) {
  const t = nameKey(termino)
  if (!t) {
    return query(
      `SELECT * FROM mis_clientes
       WHERE archived = 0
       ORDER BY times_used DESC, last_used_at DESC, name ASC
       LIMIT $1`,
      [limite],
    )
  }
  return query(
    `SELECT * FROM mis_clientes
     WHERE archived = 0 AND name_key LIKE $1
     ORDER BY
       CASE WHEN name_key LIKE $2 THEN 0 ELSE 1 END,  -- los que empiezan igual, primero
       times_used DESC, name ASC
     LIMIT $3`,
    [`%${t}%`, `${t}%`, limite],
  )
}

export function listAll({ includeArchived = false } = {}) {
  return query(
    `SELECT * FROM mis_clientes
     WHERE ($1 = 1 OR archived = 0)
     ORDER BY name ASC`,
    [includeArchived ? 1 : 0],
  )
}

export function getById(id) {
  return queryOne(`SELECT * FROM mis_clientes WHERE id = $1`, [id])
}

export function getByName(name) {
  return queryOne(`SELECT * FROM mis_clientes WHERE name_key = $1`, [nameKey(name)])
}

/**
 * El corazon del "auto-guardado inteligente".
 *
 * Si el cliente no existe, lo crea. Si ya existe, solo rellena los campos
 * que estaban vacios — nunca pisa un dato que el usuario ya guardo. Si en
 * la ficha del cliente hay un telefono y en esta factura lo dejas en blanco,
 * el telefono se conserva.
 *
 * Devuelve el cliente completo, ya con su id.
 */
export async function upsertByName(datos) {
  const name = String(datos.name ?? '').trim()
  if (!name) return null

  const key = nameKey(name)
  const existente = await queryOne(`SELECT * FROM mis_clientes WHERE name_key = $1`, [key])

  if (!existente) {
    const { lastInsertId } = await execute(
      `INSERT INTO clients (account_id, name, name_key, email, phone, address,
                            tax_id, notes, times_used, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, datetime('now'))`,
      [
        await cuentaActual(),
        name,
        key,
        datos.email ?? '',
        datos.phone ?? '',
        datos.address ?? '',
        datos.tax_id ?? '',
        datos.notes ?? '',
      ],
    )
    return getById(lastInsertId)
  }

  // COALESCE(NULLIF(...)) = "usa el valor nuevo solo si el guardado esta vacio"
  await execute(
    `UPDATE clients SET
       name         = $1,
       email        = COALESCE(NULLIF(email, ''),   $2),
       phone        = COALESCE(NULLIF(phone, ''),   $3),
       address      = COALESCE(NULLIF(address, ''), $4),
       tax_id       = COALESCE(NULLIF(tax_id, ''),  $5),
       times_used   = times_used + 1,
       last_used_at = datetime('now'),
       archived     = 0
     WHERE id = $6`,
    [
      name,
      datos.email ?? '',
      datos.phone ?? '',
      datos.address ?? '',
      datos.tax_id ?? '',
      existente.id,
    ],
  )
  return getById(existente.id)
}

/** Edicion explicita desde la pantalla de Clientes: aqui SI se pisa todo. */
export async function update(id, datos) {
  if (!(await getById(id))) throw new Error('El cliente no está disponible en esta cuenta')
  const nombre = String(datos.name ?? '').trim()
  if (!nombre) throw new Error('El nombre es obligatorio')
  const otro = await getByName(nombre)
  if (otro && otro.id !== id) throw new Error('Ya existe otro cliente con ese nombre')
  await execute(
    `UPDATE clients SET
       name = $1, name_key = $2, email = $3, phone = $4,
       address = $5, tax_id = $6, notes = $7
     WHERE id = $8 AND account_id = $9`,
    [
      nombre,
      nameKey(nombre),
      datos.email ?? '',
      datos.phone ?? '',
      datos.address ?? '',
      datos.tax_id ?? '',
      datos.notes ?? '',
      id,
      await cuentaActual(),
    ],
  )
  return getById(id)
}

/**
 * Archiva en lugar de borrar. Las facturas viejas guardan una copia propia
 * de los datos del cliente, asi que siguen imprimiendose bien igualmente.
 */
export function archive(id) {
  return execute(`UPDATE clients SET archived = 1 WHERE id = $1`, [id])
}

export function unarchive(id) {
  return execute(`UPDATE clients SET archived = 0 WHERE id = $1`, [id])
}

/**
 * Cuantas facturas tiene y cuanto suma — para la ficha del cliente.
 * Lee de la vista `facturas`: lo cotizado y no aceptado no es facturacion.
 */
export function stats(id) {
  return queryOne(
    `SELECT
       COUNT(*)                                                    AS total_facturas,
       COALESCE(SUM(total_cents), 0)                               AS total_facturado,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN total_cents END), 0) AS total_pendiente
     FROM facturas
     WHERE client_id = $1 AND status != 'cancelled'`,
    [id],
  )
}
