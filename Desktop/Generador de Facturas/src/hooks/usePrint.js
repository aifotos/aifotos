import { useCallback } from 'react'

/**
 * Abre el dialogo de impresion de macOS, desde donde se elige
 * "PDF > Guardar como PDF".
 *
 * Se imprime de verdad en lugar de rasterizar el documento a imagen
 * (html2canvas + jsPDF): asi el PDF sale con texto real —seleccionable,
 * buscable y nitido a cualquier zoom— y pesa una fraccion de lo que
 * pesaria una captura.
 *
 * En la app nativa la orden va por un comando de Rust, NO por
 * `window.print()`. WKWebView declara `window.print` como funcion pero no
 * hace absolutamente nada: retorna en 1 ms y no dispara ni `beforeprint`
 * ni `afterprint`. Comprobado con una sonda. En el navegador
 * (`npm run dev`) si funciona, y ahi se usa.
 */
export default function usePrint() {
  return useCallback(async () => {
    // Ceder dos fotogramas antes de imprimir. `print()` congela el hilo, y
    // sin esto el motor puede capturar la pagina antes de haber pintado el
    // ultimo cambio del formulario: la factura saldria con el penultimo
    // estado.
    await new Promise((listo) =>
      requestAnimationFrame(() => requestAnimationFrame(listo)),
    )

    if ('__TAURI_INTERNALS__' in window) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('imprimir')
      return
    }

    window.print()
  }, [])
}
