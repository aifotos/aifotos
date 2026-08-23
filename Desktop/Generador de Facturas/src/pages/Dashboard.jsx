import { useEffect, useMemo, useState } from 'react'
import { FileText, Search, Plus, Loader2 } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import SummaryCards from '../components/dashboard/SummaryCards.jsx'
import InvoiceRow from '../components/dashboard/InvoiceRow.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import * as invoices from '../db/invoices.js'

const FILTROS = [
  { id: null, label: 'Todas' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'paid', label: 'Pagadas' },
  { id: 'draft', label: 'Borradores' },
]

/** Pantalla principal: resumen + historial de facturas. */
export default function Dashboard({ moneda = 'RD$', onNuevaFactura, onAbrirFactura }) {
  const [lista, setLista] = useState([])
  const [resumen, setResumen] = useState(null)
  const [filtro, setFiltro] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    Promise.all([invoices.list({ status: filtro, search: busqueda }), invoices.summary()])
      .then(([filas, sum]) => {
        if (!vivo) return
        setLista(filas)
        setResumen(sum)
      })
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [filtro, busqueda])

  const hayFacturas = lista.length > 0
  // Si no hay ninguna factura y tampoco hay filtro activo, la app esta
  // recien instalada; si hay filtro, es que el filtro no encontro nada.
  const vacioReal = !hayFacturas && !filtro && !busqueda.trim()

  const titulo = useMemo(() => {
    if (cargando) return null
    const n = lista.length
    return `${n} ${n === 1 ? 'factura' : 'facturas'}`
  }, [lista.length, cargando])

  return (
    <>
      <PageHeader
        title="Facturas"
        subtitle={titulo}
        actions={
          <Button variant="primary" icon={Plus} onClick={onNuevaFactura}>
            Nueva factura
          </Button>
        }
      />

      <div className="px-8 py-6 space-y-6">
        <SummaryCards resumen={resumen} moneda={moneda} />

        {/* Filtros y buscador */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-line/50 rounded-xl">
            {FILTROS.map(({ id, label }) => (
              <button
                key={label}
                onClick={() => setFiltro(id)}
                className={`h-8 px-3 rounded-lg text-[13px] font-medium transition-colors
                  ${
                    filtro === id
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-soft hover:text-ink'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-faint pointer-events-none" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por cliente o número…"
              className="h-9 w-64 pl-9 pr-3 rounded-xl bg-surface border border-line
                text-sm text-ink placeholder:text-ink-faint
                focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="bg-surface border border-line rounded-card overflow-hidden">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-20 text-ink-soft text-sm">
              <Loader2 className="size-4 animate-spin" /> Cargando…
            </div>
          ) : vacioReal ? (
            <EmptyState
              icon={FileText}
              title="Todavía no hay facturas"
              description="Crea tu primera factura. Los clientes y servicios que escribas se guardarán solos para la próxima."
              action={
                <Button variant="primary" icon={Plus} onClick={onNuevaFactura}>
                  Crear la primera
                </Button>
              }
            />
          ) : !hayFacturas ? (
            <EmptyState
              icon={Search}
              title="Sin resultados"
              description="Ninguna factura coincide con lo que buscas."
              action={
                <Button
                  onClick={() => {
                    setFiltro(null)
                    setBusqueda('')
                  }}
                >
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {lista.map((f) => (
                <InvoiceRow
                  key={f.id}
                  invoice={f}
                  onAbrir={onAbrirFactura}
                  onMenu={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
