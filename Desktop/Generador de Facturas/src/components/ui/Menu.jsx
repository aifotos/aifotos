import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Menu contextual anclado a un punto de la pantalla.
 *
 * Va en un portal con posicion fija por lo mismo que el autocompletado:
 * dentro del flujo lo recortaria el contenedor de la lista, y en la
 * ultima fila quedaria medio fuera.
 */
export default function Menu({ en, onCerrar, children }) {
  const caja = useRef(null)

  useEffect(() => {
    if (!en) return
    const fuera = (e) => !caja.current?.contains(e.target) && onCerrar()
    const escape = (e) => e.key === 'Escape' && onCerrar()
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    // Cerrar tambien al hacer scroll: un menu flotando sobre una lista que
    // se mueve queda apuntando a la fila equivocada.
    window.addEventListener('scroll', onCerrar, true)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', onCerrar, true)
    }
  }, [en, onCerrar])

  if (!en) return null

  const ANCHO = 200
  const ALTO_APROX = 190
  const estilo = {
    position: 'fixed',
    left: Math.min(en.x, window.innerWidth - ANCHO - 8),
    // Si no cabe debajo del cursor, se abre hacia arriba.
    top: en.y + ALTO_APROX > window.innerHeight ? undefined : en.y,
    bottom: en.y + ALTO_APROX > window.innerHeight ? window.innerHeight - en.y : undefined,
    width: ANCHO,
  }

  return createPortal(
    <div
      ref={caja}
      role="menu"
      style={estilo}
      className="no-print z-50 bg-surface border border-line rounded-xl shadow-pop py-1"
    >
      {children}
    </div>,
    document.body,
  )
}

export function MenuItem({ icon: Icon, children, peligroso = false, ...props }) {
  return (
    <button
      role="menuitem"
      className={`w-full h-9 px-3 flex items-center gap-2.5 text-left text-sm
        transition-colors
        ${peligroso
          ? 'text-overdue-ink hover:bg-overdue-bg'
          : 'text-ink hover:bg-canvas'}`}
      {...props}
    >
      {Icon && <Icon className="size-4 shrink-0" strokeWidth={2} />}
      {children}
    </button>
  )
}

export function MenuSeparator() {
  return <div className="my-1 border-t border-line" />
}
