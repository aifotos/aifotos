import { ArchiveRestore, Archive } from 'lucide-react'

/**
 * Archivar y recuperar una ficha del catalogo.
 *
 * Archivar, y no borrar de verdad, porque las facturas ya emitidas
 * apuntan a estas filas. Un borrado real dejaria `client_id` y
 * `service_id` en NULL y la factura perderia el enlace con su cliente y
 * con el servicio — seguiria imprimiendose bien, porque guarda su copia
 * congelada de los datos, pero las estadisticas del cliente y el
 * "usado N veces" del catalogo quedarian mintiendo para siempre.
 *
 * A efectos practicos archivar ES borrar: la ficha desaparece del
 * selector de la factura y de esta lista. Lo que no hace es reescribir
 * tu historial.
 */
export default function BotonArchivar({ archivado, nombre, onAlternar }) {
  const Icono = archivado ? ArchiveRestore : Archive
  return (
    <button
      type="button"
      onClick={onAlternar}
      title={archivado ? 'Recuperar' : 'Archivar'}
      aria-label={archivado ? `Recuperar ${nombre}` : `Archivar ${nombre}`}
      className="size-8 shrink-0 rounded-lg flex items-center justify-center
        text-ink-faint transition-colors
        hover:bg-overdue-bg hover:text-overdue-ink
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <Icono className="size-4" strokeWidth={2} />
    </button>
  )
}

/** Interruptor «Ver archivados» para la cabecera de las dos pantallas. */
export function InterruptorArchivados({ activo, onCambiar, n }) {
  return (
    <button
      type="button"
      onClick={() => onCambiar(!activo)}
      className={`h-8 px-3 rounded-lg text-[13px] font-medium transition-colors
        ${activo ? 'bg-surface text-ink border border-line' : 'text-ink-soft hover:text-ink hover:bg-line/50'}`}
    >
      {activo ? 'Ocultar archivados' : 'Ver archivados'}
      {!activo && n > 0 && <span className="text-ink-faint"> ({n})</span>}
    </button>
  )
}
