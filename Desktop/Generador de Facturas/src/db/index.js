import Database from '@tauri-apps/plugin-sql'

/**
 * Conexion unica a la base de datos local.
 *
 * El archivo vive en la carpeta de datos de la app
 * (~/Library/Application Support/com.aifotos.facturapro/facturapro.db),
 * no dentro del proyecto: asi las facturas sobreviven a una reinstalacion
 * o a un `npm run app:build`.
 *
 * Las migraciones las corre Tauri al arrancar (src-tauri/src/lib.rs),
 * antes de que este modulo pueda conectarse.
 */
let conexion = null

export function getDb() {
  // Se guarda la promesa, no el resultado: si dos componentes piden la
  // base de datos a la vez durante el arranque, ambos esperan la misma
  // conexion en lugar de abrir dos.
  if (!conexion) {
    conexion = Database.load('sqlite:facturapro.db')
  }
  return conexion
}

/** SELECT — devuelve un array de filas. */
export async function query(sql, params = []) {
  const db = await getDb()
  return db.select(sql, params)
}

/** SELECT de una sola fila — devuelve la fila o null. */
export async function queryOne(sql, params = []) {
  const filas = await query(sql, params)
  return filas.length > 0 ? filas[0] : null
}

/** INSERT / UPDATE / DELETE — devuelve { rowsAffected, lastInsertId }. */
export async function execute(sql, params = []) {
  const db = await getDb()
  return db.execute(sql, params)
}

/**
 * Ejecuta varias operaciones como una sola transaccion.
 * Si algo falla a la mitad, se deshace todo.
 *
 * Es imprescindible al guardar una factura: la cabecera y sus lineas
 * tienen que entrar juntas o no entrar. Una factura con la mitad de sus
 * lineas es peor que ninguna factura.
 */
export async function transaction(fn) {
  const db = await getDb()
  await db.execute('BEGIN')
  try {
    const resultado = await fn(db)
    await db.execute('COMMIT')
    return resultado
  } catch (error) {
    await db.execute('ROLLBACK')
    throw error
  }
}

/**
 * Clave de deduplicacion para nombres de clientes y servicios.
 * "  JUAN   Pérez " y "juan pérez" deben ser el mismo registro.
 */
export function nameKey(name) {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}
