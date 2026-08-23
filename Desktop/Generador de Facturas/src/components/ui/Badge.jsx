import { ESTADOS } from '../../db/invoices.js'

/**
 * Etiqueta de estado de una factura.
 *
 * "Vencida" no es un estado guardado en la base: es una factura `pending`
 * cuya fecha de vencimiento ya paso. Se calcula al mostrarla, para que no
 * haya que ir cambiando filas cada medianoche.
 */
const TONOS = {
  paid: 'bg-paid-bg text-paid-ink',
  pending: 'bg-pending-bg text-pending-ink',
  overdue: 'bg-overdue-bg text-overdue-ink',
  draft: 'bg-draft-bg text-draft-ink',
}

export default function Badge({ status, overdue = false, className = '' }) {
  const tono = overdue ? 'overdue' : (ESTADOS[status]?.tone ?? 'draft')
  const texto = overdue ? 'Vencida' : (ESTADOS[status]?.label ?? status)

  return (
    <span
      className={`inline-flex items-center h-6 px-2.5 rounded-full
        text-xs font-medium whitespace-nowrap ${TONOS[tono]} ${className}`}
    >
      {texto}
    </span>
  )
}
