import { TrendingUp, Clock, AlertTriangle, Send, CheckCircle2, CalendarX } from 'lucide-react'
import { formatMoney } from '../../lib/money.js'

/**
 * Las tres cifras que quieres ver al abrir la app: cuanto cobraste,
 * cuanto te deben y cuanto de eso ya esta vencido.
 *
 * La tarjeta de vencido solo aparece si hay algo vencido. Una tarjeta
 * roja con RD$ 0.00 permanente entrena al ojo a ignorarla.
 */
export default function SummaryCards({ resumen, kind = 'invoice', moneda = 'RD$' }) {
  if (!resumen) return null

  const tarjetas = kind === 'quote' ? tarjetasCotizacion(resumen, moneda) : tarjetasFactura(resumen, moneda)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {tarjetas.map(({ label, valor, detalle, icon: Icon, color, fondo }) => (
        <div
          key={label}
          className="bg-surface border border-line rounded-card p-4 flex items-start gap-3"
        >
          <div className={`size-9 rounded-lg ${fondo} flex items-center justify-center shrink-0`}>
            <Icon className={`size-4.5 ${color}`} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-soft">{label}</p>
            <p className="text-lg font-semibold text-ink tracking-tight tabular-nums truncate">
              {valor}
            </p>
            {detalle && <p className="text-xs text-ink-faint">{detalle}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

function tarjetasFactura(resumen, moneda) {
  return [
    {
      label: 'Cobrado',
      valor: formatMoney(resumen.cobrado, moneda),
      icon: TrendingUp,
      color: 'text-paid-ink',
      fondo: 'bg-paid-bg',
    },
    {
      label: 'Por cobrar',
      valor: formatMoney(resumen.por_cobrar, moneda),
      detalle:
        resumen.n_pendientes > 0
          ? `${resumen.n_pendientes} factura${resumen.n_pendientes === 1 ? '' : 's'}`
          : null,
      icon: Clock,
      color: 'text-pending-ink',
      fondo: 'bg-pending-bg',
    },
    ...(resumen.vencido > 0
      ? [
          {
            label: 'Vencido',
            valor: formatMoney(resumen.vencido, moneda),
            icon: AlertTriangle,
            color: 'text-overdue-ink',
            fondo: 'bg-overdue-bg',
          },
        ]
      : []),
  ]
}

/**
 * Las cifras de las cotizaciones no son dinero cobrado ni por cobrar: son
 * trabajo por cerrar. La etiqueta lo dice explicitamente ("valor cotizado")
 * para que nadie lea ese numero como ingresos.
 */
function tarjetasCotizacion(resumen, moneda) {
  return [
    {
      label: 'Valor cotizado',
      valor: formatMoney(resumen.valor_enviado, moneda),
      detalle:
        resumen.n_enviadas > 0
          ? `${resumen.n_enviadas} enviada${resumen.n_enviadas === 1 ? '' : 's'}, sin respuesta`
          : 'nada pendiente de respuesta',
      icon: Send,
      color: 'text-pending-ink',
      fondo: 'bg-pending-bg',
    },
    {
      label: 'Aceptadas',
      valor: String(resumen.n_aceptadas),
      detalle: resumen.n_borradores > 0 ? `${resumen.n_borradores} en borrador` : null,
      icon: CheckCircle2,
      color: 'text-paid-ink',
      fondo: 'bg-paid-bg',
    },
    ...(resumen.n_caducadas > 0
      ? [
          {
            label: 'Caducadas',
            valor: String(resumen.n_caducadas),
            detalle: 'pasó su fecha de validez',
            icon: CalendarX,
            color: 'text-ink-soft',
            fondo: 'bg-draft-bg',
          },
        ]
      : []),
  ]
}
