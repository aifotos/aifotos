import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Dialogo modal. Se cierra con Escape o pulsando fuera.
 *
 * Va en un portal a `body` para que no lo recorte ningun panel con scroll,
 * y lleva `no-print` porque un dialogo abierto no debe salir en el PDF.
 */
export default function Modal({ abierto, onCerrar, title, description, children }) {
  useEffect(() => {
    if (!abierto) return
    const alPulsar = (e) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [abierto, onCerrar])

  if (!abierto) return null

  return createPortal(
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-6
        bg-ink/20 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm bg-surface rounded-2xl shadow-pop border border-line p-6"
      >
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">{description}</p>
        )}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
