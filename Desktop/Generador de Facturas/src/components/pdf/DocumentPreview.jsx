import { useEffect, useRef, useState } from 'react'

// A4 en pixeles CSS a 96 dpi: 210 mm y 297 mm.
const ANCHO_A4 = 794
const ALTO_A4 = 1123

/**
 * Cambio minimo de escala que merece un reajuste.
 *
 * Existe por un bucle que hacia temblar la vista previa. La secuencia era
 * esta: el documento se agranda -> ya no cabe a lo alto -> aparece la barra
 * de scroll -> el panel pierde 10 px de ancho -> el documento se encoge ->
 * vuelve a caber -> la barra desaparece -> el panel recupera los 10 px ->
 * el documento se agranda… varias veces por segundo, que es exactamente el
 * "shake" que se veia.
 *
 * La causa se corrige en el editor, reservando siempre el hueco de la barra
 * (`overflow-y-scroll`), pero el umbral se queda como red: cualquier otra
 * realimentacion futura entre el tamano del panel y el del documento se
 * queda en un cambio inapreciable en vez de una oscilacion visible.
 *
 * El 3 % no es un numero al azar: medido en el editor, la barra de scroll
 * son 10 px sobre unos 510 utiles, o sea que quitarla y ponerla cambiaba
 * la escala un 2,0 %. El umbral tiene que quedar POR ENCIMA de eso o no
 * frena nada. A cambio, al redimensionar la ventana el documento se
 * reajusta a saltos del 3 %, que no se distinguen de un ajuste continuo.
 */
const UMBRAL = 0.03

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
      const cruda = Math.min(escalaMaxima, Math.max(0.25, disponible / ANCHO_A4))
      // Se redondea a tres decimales para que un reflujo de medio pixel no
      // cuente como cambio, y se ignora todo lo que no supere el umbral.
      const nueva = Math.round(cruda * 1000) / 1000
      setEscala((actual) => (Math.abs(actual - nueva) < UMBRAL ? actual : nueva))
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
