/**
 * Puente entre la consola del webview y el log de Tauri.
 *
 * En una app de escritorio el webview no tiene una consola visible: si algo
 * falla al arrancar, la ventana se queda en blanco y no hay ni un mensaje.
 * Esto reenvia console.* y los errores no capturados al log de Tauri, que
 * sale por la terminal donde corriste `npm run app:dev`.
 *
 * En el navegador no hace nada: ahi ya tienes las herramientas de desarrollo.
 */
export function conectarConsola() {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return

  import('@tauri-apps/plugin-log')
    .then(({ attachConsole, error }) => {
      attachConsole()

      window.addEventListener('error', (e) => {
        error(`[window.onerror] ${e.message}  (${e.filename}:${e.lineno}:${e.colno})`)
      })

      window.addEventListener('unhandledrejection', (e) => {
        const motivo = e.reason
        error(
          `[promesa no capturada] ${motivo?.message ?? motivo}` +
            (motivo?.stack ? `\n${motivo.stack}` : ''),
        )
      })
    })
    .catch(() => {
      // Sin log no se puede reportar que fallo el log. Se sigue sin el.
    })
}

/**
 * Registra un fallo grave en el log de Tauri.
 *
 * Se usa en los errores que la app atrapa y convierte en una pantalla
 * bonita: sin esto, el usuario ve "no se pudo abrir la base de datos" y
 * en el archivo de log no queda ni rastro de por que.
 */
export function registrarFallo(contexto, e) {
  const texto = `[${contexto}] ${e?.message ?? e}${e?.stack ? `\n${e.stack}` : ''}`
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    import('@tauri-apps/plugin-log').then(({ error }) => error(texto)).catch(() => {})
  }
  console.error(texto)
}
