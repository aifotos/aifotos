import { estadosDe } from '../../db/invoices.js'

/**
 * Etiqueta de estado de un documento.
 *
 * Tres de las etiquetas no son estados guardados, sino situaciones que se
 * calculan al mostrarlas, para no tener que ir cambiando filas cada
 * medianoche ni duplicar informacion que ya esta en los datos:
 *
 *   Vencida    factura pendiente cuya fecha de pago ya paso
 *   Caducada   cotizacion enviada que dejo de estar vigente
 *   Convertida cotizacion que ya tiene una factura enlazada
 *
 * Vencida y Caducada NO comparten color a proposito: una es una deuda que
 * te deben y la otra un presupuesto que expiro sin mas.
 */
const TONOS = {
  paid: 'bg-paid-bg text-paid-ink',
  pending: 'bg-pending-bg text-pending-ink',
  overdue: 'bg-overdue-bg text-overdue-ink',
  draft: 'bg-draft-bg text-draft-ink',
}

export default function Badge({
  status,
  kind = 'invoice',
  overdue = false,
  expired = false,
  converted = false,
  className = '',
}) {
  const estados = estadosDe(kind)
  let tono = estados[status]?.tone ?? 'draft'
  let texto = estados[status]?.label ?? status

  if (converted) {
    tono = 'paid'
    texto = 'Convertida'
  } else if (overdue) {
    tono = 'overdue'
    texto = 'Vencida'
  } else if (expired) {
    tono = 'draft'
    texto = 'Caducada'
  }

  return (
    <span
      className={`inline-flex items-center h-6 px-2.5 rounded-full
        text-xs font-medium whitespace-nowrap ${TONOS[tono]} ${className}`}
    >
      {texto}
    </span>
  )
}
