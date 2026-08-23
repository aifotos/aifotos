/**
 * Base de datos para `npm run dev` (modo navegador, sin Tauri).
 *
 * Corre el MISMO SQLite, compilado a WebAssembly, con el MISMO archivo de
 * esquema que usa la app nativa. No es una simulacion: las consultas, los
 * CHECK, los triggers y el borrado en cascada se comportan igual.
 *
 * Diferencias con el modo nativo:
 *   - Vive en memoria y se guarda en localStorage al cerrar la pestana.
 *   - Trae datos de ejemplo la primera vez, para poder maquetar con
 *     contenido realista en lugar de pantallas vacias.
 *
 * Este archivo NO llega a la app compilada: se importa de forma dinamica
 * detras de `import.meta.env.DEV`, asi que Vite lo elimina en produccion.
 */
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import esquema from '../../src-tauri/migrations/001_esquema_inicial.sql?raw'
import { datosDeEjemplo } from './seed.js'

const CLAVE = 'facturapro:dev-db'

/** Adaptador con la misma interfaz que `@tauri-apps/plugin-sql`. */
class BrowserDatabase {
  constructor(db) {
    this.db = db
  }

  async select(sql, params = []) {
    const stmt = this.db.prepare(sql)
    stmt.bind(bindings(sql, params))
    const filas = []
    while (stmt.step()) filas.push(stmt.getAsObject())
    stmt.free()
    return filas
  }

  async execute(sql, params = []) {
    const stmt = this.db.prepare(sql)
    stmt.bind(bindings(sql, params))
    stmt.step()
    stmt.free()
    const resultado = {
      rowsAffected: this.db.getRowsModified(),
      lastInsertId: this.db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0,
    }
    guardar(this.db)
    return resultado
  }
}

/**
 * sql.js liga por nombre ($1, $2...); tauri-plugin-sql recibe un array.
 * Traduce lo segundo a lo primero.
 */
function bindings(sql, params) {
  const nombres = {}
  params.forEach((valor, i) => {
    nombres[`$${i + 1}`] = valor === undefined ? null : valor
  })
  // Solo pasa los parametros que la consulta realmente usa.
  const usados = new Set(sql.match(/\$\d+/g) ?? [])
  return Object.fromEntries(Object.entries(nombres).filter(([k]) => usados.has(k)))
}

function guardar(db) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(Array.from(db.export())))
  } catch {
    // Si no cabe en localStorage, se pierde al recargar. Es modo desarrollo.
  }
}

export async function loadBrowserDatabase() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })

  const guardada = localStorage.getItem(CLAVE)
  if (guardada) {
    try {
      return new BrowserDatabase(new SQL.Database(new Uint8Array(JSON.parse(guardada))))
    } catch {
      localStorage.removeItem(CLAVE)
    }
  }

  const db = new SQL.Database()
  db.run(esquema)
  db.run(datosDeEjemplo)
  guardar(db)
  console.info(
    '%c[FacturaPro] Modo navegador — SQLite en WebAssembly con datos de ejemplo.\n' +
      'Para la app real con tus datos: npm run app:dev',
    'color:#2560e0',
  )
  return new BrowserDatabase(db)
}

/** Borra la base de desarrollo y recarga. Util desde la consola. */
export function resetBrowserDatabase() {
  localStorage.removeItem(CLAVE)
  location.reload()
}
