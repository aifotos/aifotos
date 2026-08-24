import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Coloca su contenido en una zona aparte del DOM, fuera de #root, que solo
 * es visible al imprimir.
 *
 * Existe porque la vista previa del editor esta reducida con
 * `transform: scale()` para caber en el panel, y ese transform se aplica
 * tambien al imprimir: la factura saldria encogida en una esquina de la
 * hoja. Esta copia se renderiza siempre a escala 1, sin transformar.
 *
 * Renderizar el documento dos veces es barato — es un componente puro sin
 * estado — y a cambio elimina toda una clase de errores en la que lo que
 * ves y lo que se imprime no coinciden.
 */
export default function PrintArea({ children }) {
  const [zona, setZona] = useState(null)

  useEffect(() => {
    let nodo = document.getElementById('zona-impresion')
    if (!nodo) {
      nodo = document.createElement('div')
      nodo.id = 'zona-impresion'
      document.body.appendChild(nodo)
    }
    setZona(nodo)
  }, [])

  if (!zona) return null
  return createPortal(children, zona)
}
