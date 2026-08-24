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
import v1 from '../../src-tauri/migrations/001_esquema_inicial.sql?raw'
import v2 from '../../src-tauri/migrations/002_numeracion_de_borradores.sql?raw'
import v3 from '../../src-tauri/migrations/003_cotizaciones.sql?raw'
import { datosDeEjemplo } from './seed.js'

const CLAVE = 'facturapro:dev-db'
const CLAVE_VERSION = 'facturapro:dev-db-version'

/**
 * Las migraciones, en orden. El indice + 1 es su version, igual que en
 * `migrations()` de src-tauri/src/lib.rs.
 */
const MIGRACIONES = [v1, v2, v3]

/** Adaptador con la misma interfaz que `@tauri-apps/plugin-sql`. */
class BrowserDatabase {
  constructor(db) {
    this.db = db
    this.enTransaccion = false
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
    const control = sql.trim().slice(0, 8).toUpperCase()
    if (control.startsWith('BEGIN')) this.enTransaccion = true

    const stmt = this.db.prepare(sql)
    stmt.bind(bindings(sql, params))
    stmt.step()
    stmt.free()
    const resultado = {
      rowsAffected: this.db.getRowsModified(),
      lastInsertId: this.db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0,
    }

    if (control.startsWith('COMMIT') || control.startsWith('ROLLBAC')) {
      this.enTransaccion = false
    }
    // Exportar la base a mitad de una transaccion la deja inconsistente y
    // hace que el COMMIT posterior falle con "no transaction is active".
    // Se persiste solo cuando no hay ninguna transaccion abierta.
    if (!this.enTransaccion) guardar(this.db)
    return resultado
  }
}

/**
 * Prepara los parametros para sql.js.
 *
 * En el codigo conviven los dos estilos que admite SQLite, y cada uno se
 * liga de una forma distinta:
 *
 *   $1, $2…   consultas escritas a mano en src/db/  -> objeto por nombre
 *   ?         sentencias generadas en lote           -> array posicional
 *
 * sqlx (la app nativa) acepta los dos sin mas; sql.js no. Mezclarlos sin
 * distinguir hacia que los `?` no ligaran nada y todo entrara como NULL.
 */
function bindings(sql, params) {
  const conNombre = sql.match(/\$\d+/g)
  if (!conNombre) {
    return params.map((v) => (v === undefined ? null : v))
  }

  const nombres = {}
  params.forEach((valor, i) => {
    nombres[`$${i + 1}`] = valor === undefined ? null : valor
  })
  // Solo pasa los parametros que la consulta realmente usa.
  const usados = new Set(conNombre)
  return Object.fromEntries(Object.entries(nombres).filter(([k]) => usados.has(k)))
}

/**
 * Vuelca la base a localStorage.
 *
 * Se agrupa con un temporizador porque `export()` serializa el archivo
 * entero (unos 160 KB): hacerlo en cada INSERT de cada linea de una
 * factura convertiria el autoguardado en un tiron perceptible.
 */
let temporizadorGuardado = null
function guardar(db) {
  clearTimeout(temporizadorGuardado)
  temporizadorGuardado = setTimeout(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(Array.from(db.export())))
    } catch {
      // Si no cabe en localStorage, se pierde al recargar. Es modo desarrollo.
    }
  }, 250)
}

export async function loadBrowserDatabase() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })

  const guardada = localStorage.getItem(CLAVE)
  if (guardada) {
    try {
      const db = new SQL.Database(new Uint8Array(JSON.parse(guardada)))
      aplicarMigracionesPendientes(db)
      return new BrowserDatabase(db)
    } catch (e) {
      // Una base de desarrollo corrupta o imposible de migrar se tira y se
      // rehace: no hay nada que perder ahi que no sean datos de ejemplo.
      console.warn('[FacturaPro] Base de desarrollo descartada:', e.message)
      localStorage.removeItem(CLAVE)
      localStorage.removeItem(CLAVE_VERSION)
    }
  }

  const db = new SQL.Database()
  for (const migracion of MIGRACIONES) db.run(migracion)
  db.run(datosDeEjemplo)
  localStorage.setItem(CLAVE_VERSION, String(MIGRACIONES.length))
  guardar(db)
  console.info(
    '%c[FacturaPro] Modo navegador — SQLite en WebAssembly con datos de ejemplo.\n' +
      'Para la app real con tus datos: npm run app:dev',
    'color:#2560e0',
  )
  return new BrowserDatabase(db)
}

/**
 * Pone al dia una base de desarrollo ya guardada.
 *
 * Sin esto, las migraciones nuevas solo se aplicaban al crear la base
 * desde cero: quien ya tuviera una en localStorage se quedaba con el
 * esquema viejo y la app fallaba con errores desconcertantes del tipo
 * "no such table: facturas". La app nativa nunca tuvo el problema porque
 * Tauri lleva su propio control de version; esto le pone el equivalente.
 */
function aplicarMigracionesPendientes(db) {
  const aplicadas = Number(localStorage.getItem(CLAVE_VERSION) ?? 0)
  if (aplicadas >= MIGRACIONES.length) return

  for (let i = aplicadas; i < MIGRACIONES.length; i++) {
    db.run(MIGRACIONES[i])
    console.info(`[FacturaPro] Migración ${i + 1} aplicada a la base de desarrollo`)
  }
  localStorage.setItem(CLAVE_VERSION, String(MIGRACIONES.length))
  guardar(db)
}

/** Borra la base de desarrollo y recarga. Util desde la consola. */
export function resetBrowserDatabase() {
  localStorage.removeItem(CLAVE)
  location.reload()
}
