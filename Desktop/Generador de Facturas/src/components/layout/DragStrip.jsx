/**
 * Franja superior invisible que permite arrastrar la ventana.
 *
 * La ventana usa `titleBarStyle: "Overlay"`: no hay barra de titulo nativa,
 * asi que macOS no sabe por donde se puede coger. Hay que decirselo con
 * `data-tauri-drag-region`, y ademas conceder el permiso
 * `core:window:allow-start-dragging` en las capabilities — `core:default`
 * NO lo incluye, y sin el los arrastres se deniegan en silencio.
 *
 * Es una franja propia y vacia, no un atributo sobre la cabecera, porque
 * Tauri solo arrastra si el clic cae justo sobre el elemento que lleva el
 * atributo. Puesto en un contenedor, cualquier hijo que lo cubra —y en una
 * cabecera siempre hay alguno— lo anula.
 *
 * Mide 40 px y no 44: las cabeceras llevan `pt-11`, o sea que sus botones
 * empiezan justo en el pixel 44 y no quedaria ni un pixel de holgura.
 * Perder 4 px de zona de arrastre no se nota; que la franja se coma el
 * borde superior de un boton, si. Los semaforos de macOS (a unos 12-32 px)
 * siguen dentro, y ademas los dibuja AppKit por encima del webview, asi
 * que reciben sus clics con normalidad.
 */
export default function DragStrip() {
  return (
    <div
      data-tauri-drag-region
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-10 z-40 no-print"
    />
  )
}
