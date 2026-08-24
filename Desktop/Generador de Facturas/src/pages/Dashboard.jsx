import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Search, Plus, Loader2, Pencil, Copy, Check, Undo2, Trash2 } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import SummaryCards from '../components/dashboard/SummaryCards.jsx'
import InvoiceRow from '../components/dashboard/InvoiceRow.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Menu, { MenuItem, MenuSeparator } from '../components/ui/Menu.jsx'
import Modal from '../components/ui/Modal.jsx'
import { esBorrador } from '../db/settings.js'
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
  const [menu, setMenu] = useState(null)          // { invoice, x, y }
  const [aBorrar, setABorrar] = useState(null)
  const [recarga, setRecarga] = useState(0)

  const refrescar = useCallback(() => setRecarga((n) => n + 1), [])

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
  }, [filtro, busqueda, recarga])

  async function cambiarEstado(invoice, status) {
    setMenu(null)
    await invoices.setStatus(invoice.id, status)
    refrescar()
  }

  async function duplicar(invoice) {
    setMenu(null)
    const copia = await invoices.duplicate(invoice.id)
    refrescar()
    if (copia) onAbrirFactura(copia)
  }

  async function borrar() {
    const id = aBorrar.id
    setABorrar(null)
    await invoices.remove(id)
    refrescar()
  }

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
                  onMenu={(invoice, e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setMenu({ invoice, x: r.right - 200, y: r.bottom + 4 })
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Menu en={menu} onCerrar={() => setMenu(null)}>
        {menu && (
          <>
            <MenuItem
              icon={Pencil}
              onClick={() => {
                setMenu(null)
                onAbrirFactura(menu.invoice)
              }}
            >
              Abrir y exportar
            </MenuItem>
            <MenuItem icon={Copy} onClick={() => duplicar(menu.invoice)}>
              Duplicar
            </MenuItem>
            <MenuSeparator />
            {menu.invoice.status === 'paid' ? (
              <MenuItem icon={Undo2} onClick={() => cambiarEstado(menu.invoice, 'pending')}>
                Marcar pendiente
              </MenuItem>
            ) : (
              <MenuItem icon={Check} onClick={() => cambiarEstado(menu.invoice, 'paid')}>
                {esBorrador(menu.invoice.number) ? 'Emitir y cobrar' : 'Marcar pagada'}
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem
              icon={Trash2}
              peligroso
              onClick={() => {
                setABorrar(menu.invoice)
                setMenu(null)
              }}
            >
              Eliminar
            </MenuItem>
          </>
        )}
      </Menu>

      <Modal
        abierto={!!aBorrar}
        onCerrar={() => setABorrar(null)}
        title="¿Eliminar esta factura?"
        description={
          aBorrar
            ? `Se borrará ${esBorrador(aBorrar.number) ? 'este borrador' : aBorrar.number} y sus líneas. No se puede deshacer, y el número no se reutiliza.`
            : ''
        }
      >
        <Button onClick={() => setABorrar(null)}>Cancelar</Button>
        <Button variant="danger" icon={Trash2} onClick={borrar}>
          Eliminar
        </Button>
      </Modal>
    </>
  )
}
