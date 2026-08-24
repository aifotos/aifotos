import { useCallback, useLayoutEffect, useRef, useState } from 'react'

const ALTO_MAXIMO = 288

/**
 * Coloca un panel flotante (lista de sugerencias, desplegable) pegado a un
 * elemento ancla, con posicion fija y fuera del flujo.
 *
 * Tiene que ser posicion fija en un portal: el formulario vive dentro de un
 * panel con scroll y la tabla de conceptos redondea sus esquinas con
 * `overflow-hidden`, asi que un panel posicionado de forma normal queda
 * recortado — y en la ultima linea de la factura, invisible del todo.
 *
 * Devuelve la caja ya calculada, incluyendo el volteo hacia arriba cuando
 * no cabe debajo.
 */
export default function useAnclaFlotante({ abierto, anchoMinimo = 0, dependencias = [] }) {
  const ancla = useRef(null)
  const [caja, setCaja] = useState(null)

  const recolocar = useCallback(() => {
    const nodo = ancla.current
    if (!nodo) return
    const r = nodo.getBoundingClientRect()
    const debajo = window.innerHeight - r.bottom
    const haciaArriba = debajo < ALTO_MAXIMO && r.top > debajo
    const ancho = Math.max(r.width, anchoMinimo)

    setCaja({
      // Si el ancho minimo lo saca por la derecha, se pega al borde.
      left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)),
      width: ancho,
      top: haciaArriba ? undefined : r.bottom + 4,
      bottom: haciaArriba ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.min(ALTO_MAXIMO, (haciaArriba ? r.top : debajo) - 12),
    })
  }, [anchoMinimo])

  useLayoutEffect(() => {
    if (!abierto) return
    recolocar()
    // `true` para capturar el scroll de CUALQUIER contenedor, no solo el de
    // la ventana: el formulario tiene su propio panel con scroll.
    window.addEventListener('scroll', recolocar, true)
    window.addEventListener('resize', recolocar)
    return () => {
      window.removeEventListener('scroll', recolocar, true)
      window.removeEventListener('resize', recolocar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, recolocar, ...dependencias])

  return { ancla, caja, recolocar }
}

/** Cierra un panel al pulsar fuera de cualquiera de los nodos indicados. */
export function useCerrarAlPulsarFuera(abierto, onCerrar, nodos) {
  useLayoutEffect(() => {
    if (!abierto) return
    const fuera = (e) => {
      if (nodos.some((n) => n.current?.contains(e.target))) return
      onCerrar()
    }
    // 'mousedown' y no 'click': el panel debe cerrarse antes de que el
    // navegador mueva el foco.
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, onCerrar])
}
