import { useEffect, useState } from 'react'
import ServiceDialog from '../components/invoice/ServiceDialog.jsx'
import Button from '../components/ui/Button.jsx'
import { Package } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { formatMoney } from '../lib/money.js'
import * as services from '../db/services.js'

/**
 * Catalogo de servicios. Igual que los clientes: se crean desde el selector
 * de cada linea de factura, y recuerdan el ultimo precio que cobraste.
 */
export default function Services({ moneda = 'RD$' }) {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    services.listAll().then(setLista).catch(e => setError(String(e))).finally(() => setCargando(false))
  }, [])

  return (
    <>
      <PageHeader
        title="Servicios"
        actions={<Button variant="primary" onClick={() => setEditing({})}>Nuevo servicio</Button>}
        subtitle={cargando ? null : `${lista.length} en el catálogo`}
      />

      {error && <p role="alert">{error}</p>}
      <ServiceDialog abierto={!!editing} servicio={editing?.id ? editing : null} moneda={moneda} onCerrar={() => setEditing(null)} onGuardado={() => services.listAll().then(setLista).catch(e => setError(String(e)))} />
      <div className="px-8 py-6">
        <div className="bg-surface border border-line rounded-card overflow-hidden">
          {!cargando && lista.length === 0 ? (
            <EmptyState
              icon={Package}
              title="El catálogo está vacío"
              description="Se crean desde la factura: pulsa «Crear servicio nuevo» en una línea y quedará guardado aquí."
            />
          ) : (
            <div className="divide-y divide-line">
              {lista.map((s) => (
                <div key={s.id} className="px-5 py-4 flex items-center gap-4 hover:bg-canvas transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{s.name}</p>
                    {s.description && (
                      <p className="text-xs text-ink-faint truncate">{s.description}</p>
                    )}
                  </div>
                  <p className="text-xs text-ink-faint whitespace-nowrap">
                    usado {s.times_used}×
                  </p>
                  <p className="text-sm font-semibold text-ink tabular-nums whitespace-nowrap">
                    {formatMoney(s.unit_price_cents, moneda)}
                    <span className="font-normal text-ink-faint"> / {s.unit}</span>
                  </p>
                  <Button size="sm" onClick={() => setEditing(s)}>Editar</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
