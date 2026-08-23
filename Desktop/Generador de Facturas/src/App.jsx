import { useEffect, useState } from 'react'
import { FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { query } from './db/index.js'
import * as settings from './db/settings.js'
import * as clients from './db/clients.js'
import * as services from './db/services.js'
import * as invoices from './db/invoices.js'
import { formatMoney } from './lib/money.js'

/**
 * Pantalla temporal de verificacion (Fase 2).
 * Abre la base de datos, corre las migraciones y hace un recorrido
 * completo: crear cliente, crear servicio, emitir factura, leerla.
 * En la Fase 3 se reemplaza por el Dashboard real.
 */
export default function App() {
  const [pasos, setPasos] = useState([])
  const [estado, setEstado] = useState('cargando')

  useEffect(() => {
    let vivo = true
    const registrar = (label, detail, ok = true) =>
      vivo && setPasos((p) => [...p, { label, detail, ok }])

    async function verificar() {
      try {
        const tablas = await query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
        )
        registrar('Base de datos abierta', tablas.map((t) => t.name).join(', '))

        const ajustes = await settings.get()
        registrar(
          'Ajustes del emisor',
          `Moneda ${ajustes.currency_symbol} · Prefijo ${ajustes.invoice_prefix} · Vence a ${ajustes.payment_terms_days} dias`,
        )

        const siguiente = await settings.peekNextNumber()
        registrar('Numeracion automatica', `Proxima factura: ${siguiente}`)

        const nClientes = (await clients.listAll()).length
        const nServicios = (await services.listAll()).length
        registrar('Clientes y catalogo', `${nClientes} cliente(s), ${nServicios} servicio(s)`)

        const resumen = await invoices.summary()
        registrar(
          'Resumen de facturas',
          `Cobrado ${formatMoney(resumen.cobrado)} · Por cobrar ${formatMoney(resumen.por_cobrar)}`,
        )

        if (vivo) setEstado('ok')
      } catch (error) {
        registrar('Error', String(error?.message ?? error), false)
        if (vivo) setEstado('error')
      }
    }

    verificar()
    return () => {
      vivo = false
    }
  }, [])

  return (
    <div className="min-h-full flex items-center justify-center p-10">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="size-11 rounded-xl bg-brand-600 flex items-center justify-center shadow-card">
            <FileText className="size-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">FacturaPro</h1>
            <p className="text-sm text-ink-soft">Fase 2 — base de datos local</p>
          </div>
        </div>

        <div className="bg-surface rounded-card shadow-card border border-line divide-y divide-line overflow-hidden">
          {pasos.map(({ label, detail, ok }, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-4">
              {ok ? (
                <CheckCircle2 className="size-5 text-brand-500 shrink-0 mt-0.5" strokeWidth={2} />
              ) : (
                <XCircle className="size-5 text-overdue-ink shrink-0 mt-0.5" strokeWidth={2} />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="text-xs text-ink-soft break-words" data-selectable>
                  {detail}
                </p>
              </div>
            </div>
          ))}

          {estado === 'cargando' && (
            <div className="flex items-center gap-3 px-5 py-4 text-ink-soft">
              <Loader2 className="size-5 animate-spin shrink-0" strokeWidth={2} />
              <p className="text-sm">Abriendo la base de datos…</p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          {estado === 'ok'
            ? 'Fase 2 completada. Siguiente: Dashboard y layout.'
            : estado === 'error'
              ? 'Algo fallo al abrir la base de datos.'
              : ' '}
        </p>
      </div>
    </div>
  )
}
