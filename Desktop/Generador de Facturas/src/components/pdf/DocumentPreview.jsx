import { useEffect, useRef, useState } from 'react'

// A4 en pixeles CSS a 96 dpi: 210 mm y 297 mm.
const ANCHO_A4 = 794
const ALTO_A4 = 1123

/**
 * Encaja el documento A4 en el panel de vista previa.
 *
 * `transform: scale()` no cambia el espacio que el elemento ocupa en el
 * flujo: sin corregirlo, un documento reducido al 60 % seguiria reservando
 * la altura del original y dejaria un hueco enorme debajo. Por eso el
 * contenedor recibe a mano las medidas ya escaladas.
 *
 * La escala se recalcula con el tamano real del panel, no con un valor
 * fijo, para que el documento se vea igual de grande en una ventana
 * pequena que en un monitor externo.
 */
export default function DocumentPreview({ children, margen = 48, escalaMaxima = 1 }) {
  const contenedor = useRef(null)
  const [escala, setEscala] = useState(0.6)

  useEffect(() => {
    const nodo = contenedor.current
    if (!nodo) return

    const observador = new ResizeObserver(([entrada]) => {
      const disponible = entrada.contentRect.width - margen
      setEscala(Math.min(escalaMaxima, Math.max(0.25, disponible / ANCHO_A4)))
    })
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [margen, escalaMaxima])

  return (
    <div ref={contenedor} className="w-full flex justify-center">
      <div style={{ width: ANCHO_A4 * escala, height: ALTO_A4 * escala }}>
        <div
          style={{
            transform: `scale(${escala})`,
            transformOrigin: 'top left',
            width: ANCHO_A4,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
