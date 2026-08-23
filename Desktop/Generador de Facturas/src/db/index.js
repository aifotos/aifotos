/**
 * Conexion unica a la base de datos local.
 *
 * En la app compilada (`npm run app:dev` / `app:build`) usa SQLite nativo
 * a traves de Tauri. El archivo vive en la carpeta de datos de la app
 * (~/Library/Application Support/com.aifotos.facturapro/facturapro.db),
 * no dentro del proyecto: asi las facturas sobreviven a una reinstalacion.
 *
 * En el navegador (`npm run dev`, para maquetar rapido) usa el mismo SQLite
 * compilado a WebAssembly, con el mismo esquema y datos de ejemplo. Ese
 * camino se elimina del build de produccion.
 */
let conexion = null

/** ¿Estamos dentro de la ventana nativa de Tauri? */
function enTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function conectar() {
  if (enTauri()) {
    const { default: Database } = await import('@tauri-apps/plugin-sql')
    return Database.load('sqlite:facturapro.db')
  }
  if (import.meta.env.DEV) {
    const { loadBrowserDatabase } = await import('./browser.js')
    return loadBrowserDatabase()
  }
  throw new Error('No hay base de datos disponible fuera de la app.')
}

export function getDb() {
  // Se guarda la promesa, no el resultado: si dos componentes piden la
  // base de datos a la vez durante el arranque, ambos esperan la misma
  // conexion en lugar de abrir dos.
  if (!conexion) conexion = conectar()
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
    // El ROLLBACK va en su propio try: si tambien falla, el error que
    // interesa es el ORIGINAL, no el del rollback. Sin esto, un fallo al
    // deshacer sustituye la causa real por "cannot rollback" y deja el
    // problema de verdad invisible.
    try {
      await db.execute('ROLLBACK')
    } catch (errorAlDeshacer) {
      error.rollbackError = errorAlDeshacer
    }
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
