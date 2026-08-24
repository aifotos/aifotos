import { useEffect, useState } from 'react'
import { Users, Mail, Phone } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import * as clients from '../db/clients.js'

/**
 * Clientes. No hay boton de "nuevo cliente" a proposito: se crean desde el
 * selector de cliente de la factura, que es donde de verdad los necesitas.
 * Esta pantalla es para consultarlos.
 */
export default function Clients() {
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    clients.listAll().then(setLista).finally(() => setCargando(false))
  }, [])

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={cargando ? null : `${lista.length} ${lista.length === 1 ? 'cliente' : 'clientes'}`}
      />

      <div className="px-8 py-6">
        <div className="bg-surface border border-line rounded-card overflow-hidden">
          {!cargando && lista.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Todavía no hay clientes"
              description="Se crean desde la factura: pulsa «Crear cliente nuevo» en el selector de cliente y aparecerá aquí."
            />
          ) : (
            <div className="divide-y divide-line">
              {lista.map((c) => (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4 hover:bg-canvas transition-colors">
                  <div className="size-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-sm font-semibold shrink-0">
                    {c.name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{c.name}</p>
                    <div className="flex items-center gap-3 text-xs text-ink-faint">
                      {c.email && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Mail className="size-3 shrink-0" /> {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Phone className="size-3 shrink-0" /> {c.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-ink-faint whitespace-nowrap">
                    {c.times_used} {c.times_used === 1 ? 'factura' : 'facturas'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
