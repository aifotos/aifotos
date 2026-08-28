import { query, queryOne, execute, fijarCuenta } from './index.js'

/**
 * Acceso por cuenta.
 *
 * La app lleva dos contabilidades distintas (aifotos y remont) en la misma
 * base de datos, y la sesion decide cual de las dos existe: mientras estas
 * dentro de una, las vistas de la base NO devuelven ni una fila de la otra
 * (ver la migracion 004). El aislamiento es de esquema, no de pantallas
 * ocultas, asi que un fallo de la interfaz no puede mezclar las dos.
 *
 * La sesion se cierra al arrancar la app. Es deliberado: el sentido de
 * tener dos cuentas es no facturar por error desde la equivocada, y para
 * eso hay que elegir a proposito cada vez que abres el programa.
 */

/**
 * PBKDF2-SHA256 con 210.000 iteraciones (la recomendacion actual de OWASP
 * para esta funcion) y una sal aleatoria por cuenta.
 *
 * Podria parecer excesivo para una app local, pero cuesta un cuarto de
 * segundo una vez al dia y evita que un vistazo al archivo .db revele
 * una contrasena que probablemente reutilices en otro sitio. Guardar el
 * texto plano habria sido mas corto de escribir y peor en todo lo demas.
 */
const ITERACIONES = 210000

function hex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function desdeHex(texto) {
  const bytes = new Uint8Array(texto.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(texto.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function subtle() {
  const c = globalThis.crypto?.subtle
  if (!c) {
    throw new Error(
      'Este navegador no expone crypto.subtle, que es lo que cifra la contraseña.',
    )
  }
  return c
}

async function derivar(contrasena, salHex) {
  const clave = await subtle().importKey(
    'raw',
    new TextEncoder().encode(contrasena),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', salt: desdeHex(salHex), iterations: ITERACIONES, hash: 'SHA-256' },
    clave,
    256,
  )
  return hex(bits)
}

function salNueva() {
  return hex(globalThis.crypto.getRandomValues(new Uint8Array(16)))
}

/**
 * Comparacion en tiempo constante.
 *
 * Con `===` el tiempo de respuesta depende de cuantos caracteres coinciden
 * al principio, y eso, medido muchas veces, filtra el hash. Aqui no hay un
 * atacante midiendo nada, pero escribir la version correcta cuesta cuatro
 * lineas y la incorrecta se copia luego a sitios donde si importa.
 */
function iguales(a, b) {
  if (a.length !== b.length) return false
  let diferencia = 0
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferencia === 0
}

// ------------------------------------------------------------- CONSULTAS

/** Las cuentas que existen, para pintar la pantalla de acceso. */
export async function listarCuentas() {
  const filas = await query(
    `SELECT id, username, display_name, password_hash
       FROM accounts ORDER BY id ASC`,
  )
  // El hash no sale de aqui: fuera solo interesa si la cuenta ya tiene
  // contrasena o hay que crearla.
  return filas.map(({ password_hash, ...c }) => ({
    ...c,
    tiene_contrasena: password_hash !== '',
  }))
}

/** La cuenta de la sesion abierta, o null si no hay ninguna. */
export function cuentaActiva() {
  return queryOne(
    `SELECT a.id, a.username, a.display_name
       FROM sesion s JOIN accounts a ON a.id = s.account_id
      WHERE s.id = 1`,
  )
}

// ------------------------------------------------------------ OPERACIONES

/**
 * Cierra cualquier sesion que hubiera quedado abierta.
 *
 * Se llama al arrancar, antes de leer nada. Sin esto la app abriria
 * directamente en la ultima cuenta usada y el acceso no serviria de nada.
 */
export async function limpiarSesion() {
  await execute(`UPDATE sesion SET account_id = NULL, started_at = NULL WHERE id = 1`)
  fijarCuenta(null)
}

export const cerrarSesion = limpiarSesion

/** Entra en una cuenta. Devuelve la cuenta, o lanza si la clave no cuadra. */
export async function iniciarSesion(username, contrasena) {
  const cuenta = await queryOne(`SELECT * FROM accounts WHERE username = $1`, [username])
  if (!cuenta) throw new Error('Esa cuenta no existe')
  if (!cuenta.password_hash) throw new Error('Esta cuenta todavía no tiene contraseña')

  const calculado = await derivar(contrasena, cuenta.password_salt)
  if (!iguales(calculado, cuenta.password_hash)) throw new Error('Contraseña incorrecta')

  await abrir(cuenta.id)
  return { id: cuenta.id, username: cuenta.username, display_name: cuenta.display_name }
}

/**
 * Pone la contrasena de una cuenta que aun no tiene, y entra.
 *
 * Es el primer arranque: ninguna de las dos cuentas trae contrasena de
 * fabrica, porque el codigo de este proyecto es publico y una clave
 * escrita en el fuente es una clave que ya no es secreta. La eliges tu la
 * primera vez y solo su hash queda en la base local.
 */
export async function crearContrasena(username, contrasena) {
  const cuenta = await queryOne(`SELECT * FROM accounts WHERE username = $1`, [username])
  if (!cuenta) throw new Error('Esa cuenta no existe')
  if (cuenta.password_hash) throw new Error('Esta cuenta ya tiene contraseña')

  await guardarContrasena(cuenta.id, contrasena)
  await abrir(cuenta.id)
  return { id: cuenta.id, username: cuenta.username, display_name: cuenta.display_name }
}

/** Cambia la contrasena. Exige la actual: sin eso, no es un cambio, es un reemplazo. */
export async function cambiarContrasena(username, actual, nueva) {
  const cuenta = await queryOne(`SELECT * FROM accounts WHERE username = $1`, [username])
  if (!cuenta) throw new Error('Esa cuenta no existe')

  if (cuenta.password_hash) {
    const calculado = await derivar(actual, cuenta.password_salt)
    if (!iguales(calculado, cuenta.password_hash)) {
      throw new Error('La contraseña actual no es correcta')
    }
  }
  await guardarContrasena(cuenta.id, nueva)
}

async function guardarContrasena(accountId, contrasena) {
  if (String(contrasena ?? '').length < 4) {
    throw new Error('La contraseña necesita al menos 4 caracteres')
  }
  const sal = salNueva()
  const hash = await derivar(contrasena, sal)
  await execute(
    `UPDATE accounts SET password_hash = $1, password_salt = $2 WHERE id = $3`,
    [hash, sal, accountId],
  )
}

async function abrir(accountId) {
  await execute(
    `UPDATE sesion SET account_id = $1, started_at = datetime('now') WHERE id = 1`,
    [accountId],
  )
  fijarCuenta(accountId)
}
