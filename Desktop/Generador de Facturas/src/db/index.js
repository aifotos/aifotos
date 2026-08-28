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
 * Ejecuta varias sentencias como UNA transaccion real: entran todas o no
 * entra ninguna.
 *
 * NO se puede hacer mandando 'BEGIN' … 'COMMIT' por la API JS de
 * tauri-plugin-sql. El plugin abre un pool de hasta 10 conexiones y reparte
 * cada `execute` por la que tenga libre, asi que el BEGIN se queda en una
 * conexion, los INSERT van por otras y el COMMIT por una cuarta: no agrupa
 * nada. Comprobado con una sonda en la app compilada — la fila insertada
 * tras el BEGIN ya era visible desde otra conexion, y el ROLLBACK fallaba
 * con "cannot rollback - no transaction is active".
 *
 * Costo real de ese fallo: facturas guardadas a medias, con su total en la
 * cabecera y sin una sola linea, porque cada sentencia se confirmaba por su
 * cuenta y bastaba que una fallara para dejar escrito todo lo anterior.
 *
 * La solucion es mandar el lote entero a Rust, que coge una unica conexion
 * del mismo pool. En el navegador no hace falta: sql.js es una sola
 * conexion en memoria y ahi BEGIN/COMMIT si funcionan.
 *
 * @param {Array<{sql: string, params?: any[]}>} sentencias
 */
export async function atomico(sentencias) {
  const lote = sentencias.filter(Boolean)
  if (lote.length === 0) return

  if (enTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('ejecutar_atomico', {
      sentencias: lote.map(({ sql, params = [] }) => ({ sql, params })),
    })
    return
  }

  const db = await getDb()
  await db.execute('BEGIN')
  try {
    for (const { sql, params = [] } of lote) await db.execute(sql, params)
    await db.execute('COMMIT')
  } catch (error) {
    // El ROLLBACK va en su propio try: si tambien falla, el error que
    // interesa es el ORIGINAL, no el del rollback.
    try {
      await db.execute('ROLLBACK')
    } catch (errorAlDeshacer) {
      error.rollbackError = errorAlDeshacer
    }
    throw error
  }
}

/**
 * La cuenta de la sesion abierta (aifotos o remont), en memoria.
 *
 * Las LECTURAS no la necesitan: pasan por vistas que ya filtran por la
 * sesion guardada en la base. Esto es para las ESCRITURAS, que si tienen
 * que decir de quien es la fila que estan creando, y para no consultar la
 * tabla `sesion` en cada INSERT de cada linea de cada factura.
 *
 * La fija `db/auth.js` al entrar y al salir. Si por lo que sea no esta
 * puesta, se lee de la base: mas lento, pero nunca escribe sin dueno.
 */
let cuentaEnMemoria = null

export function fijarCuenta(accountId) {
  cuentaEnMemoria = accountId
}

export async function cuentaActual() {
  if (cuentaEnMemoria != null) return cuentaEnMemoria
  const fila = await queryOne(`SELECT account_id FROM sesion WHERE id = 1`)
  cuentaEnMemoria = fila?.account_id ?? null
  if (cuentaEnMemoria == null) {
    throw new Error('No hay ninguna sesión abierta')
  }
  return cuentaEnMemoria
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
