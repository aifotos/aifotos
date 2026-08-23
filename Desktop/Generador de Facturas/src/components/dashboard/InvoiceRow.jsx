import { MoreHorizontal } from 'lucide-react'
import Badge from '../ui/Badge.jsx'
import { formatMoney } from '../../lib/money.js'
import { formatDateShort, dueLabel } from '../../lib/dates.js'
import { isOverdue } from '../../db/invoices.js'

/** Una fila de la lista de facturas. Toda la fila es clicable. */
export default function InvoiceRow({ invoice, onAbrir, onMenu }) {
  const vencida = isOverdue(invoice)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAbrir(invoice)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onAbrir(invoice))}
      className="group grid grid-cols-[7rem_1fr_auto_auto_2rem] items-center gap-4
        px-5 h-16 cursor-default transition-colors
        hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink tabular-nums">{invoice.number}</p>
        <p className="text-xs text-ink-faint">{formatDateShort(invoice.issue_date)}</p>
      </div>

      <div className="min-w-0">
        <p className="text-sm text-ink truncate">
          {invoice.client_name || <span className="text-ink-faint">Sin cliente</span>}
        </p>
        <p className="text-xs text-ink-faint truncate">
          {invoice.item_count} {invoice.item_count === 1 ? 'línea' : 'líneas'}
          {vencida && <span className="text-overdue-ink"> · {dueLabel(invoice.due_date)}</span>}
        </p>
      </div>

      <Badge status={invoice.status} overdue={vencida} />

      <p className="text-sm font-semibold text-ink tabular-nums text-right min-w-28">
        {formatMoney(invoice.total_cents, invoice.currency_symbol)}
      </p>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onMenu(invoice, e)
        }}
        aria-label={`Opciones de ${invoice.number}`}
        className="size-8 rounded-lg flex items-center justify-center text-ink-faint
          opacity-0 group-hover:opacity-100 focus-visible:opacity-100
          hover:bg-line hover:text-ink transition"
      >
        <MoreHorizontal className="size-4" strokeWidth={2} />
      </button>
    </div>
  )
}
