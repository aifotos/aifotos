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
import { doc as vocabulario } from '../lib/documentos.js'
import * as invoices from '../db/invoices.js'
import * as quotes from '../db/quotes.js'

const FILTROS = {
  invoice: [
    { id: null, label: 'Todas' },
    { id: 'pending', label: 'Pendientes' },
    { id: 'paid', label: 'Pagadas' },
    { id: 'draft', label: 'Borradores' },
  ],
  quote: [
    { id: null, label: 'Todas' },
    { id: 'sent', label: 'Enviadas' },
    { id: 'accepted', label: 'Aceptadas' },
    { id: 'draft', label: 'Borradores' },
  ],
}

/**
 * Listado de documentos: facturas o cotizaciones.
 *
 * Es la misma pantalla para las dos porque el listado es identico; lo que
 * cambia son los filtros, las cifras de arriba y el vocabulario. Duplicarla
 * habria sido garantizar que dentro de un mes solo una de las dos copias
 * tuviera el arreglo del proximo fallo.
 */
export default function Dashboard({ kind = 'invoice', moneda = 'RD$', onNuevaFactura, onAbrirFactura }) {
  const v = vocabulario(kind)
  const datos = kind === 'quote' ? quotes : invoices
  const [lista, setLista] = useState([])
  const [resumen, setResumen] = useState(null)
  const [filtro, setFiltro] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [menu, setMenu] = useState(null)          // { invoice, x, y }
  const [aBorrar, setABorrar] = useState(null)
  const [recarga, setRecarga] = useState(0)

  const refrescar = useCallback(() => setRecarga((n) => n + 1), [])

  // Al cambiar de seccion se sueltan filtro y busqueda: 'pending' no existe
  // entre las cotizaciones y dejaria el listado vacio sin explicacion.
  useEffect(() => {
    setFiltro(null)
    setBusqueda('')
  }, [kind])

  useEffect(() => {
    let vivo = true
    setCargando(true)
    Promise.all([datos.list({ status: filtro, search: busqueda }), datos.summary()])
      .then(([filas, sum]) => {
        if (!vivo) return
        setLista(filas)
        setResumen(sum)
      })
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [filtro, busqueda, recarga, kind, datos])

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

  async function convertir(cotizacion) {
    setMenu(null)
    const factura = await quotes.convertirEnFactura(cotizacion.id)
    refrescar()
    if (factura) onAbrirFactura(factura)
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
    return `${n} ${n === 1 ? v.singular : v.seccion.toLowerCase()}`
  }, [lista.length, cargando, v])

  return (
    <>
      <PageHeader
        title={v.seccion}
        subtitle={titulo}
        actions={
          <Button variant="primary" icon={Plus} onClick={onNuevaFactura}>
            {v.nuevo}
          </Button>
        }
      />

      <div className="px-8 py-6 space-y-6">
        <SummaryCards resumen={resumen} kind={kind} moneda={moneda} />

        {/* Filtros y buscador */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-line/50 rounded-xl">
            {FILTROS[kind].map(({ id, label }) => (
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
              placeholder={`Buscar ${v.articulo} ${v.singular}…`}
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
              title={`Todavía no hay ${v.seccion.toLowerCase()}`}
              description={`Crea tu primera ${v.singular}. Los clientes y servicios que crees quedan guardados para reutilizarlos.`}
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
              description={`Ninguna ${v.singular} coincide con lo que buscas.`}
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
            {kind === 'quote' ? (
              <>
                {menu.invoice.status !== 'accepted' && (
                  <MenuItem icon={Check} onClick={() => cambiarEstado(menu.invoice, 'accepted')}>
                    {esBorrador(menu.invoice.number) ? 'Enviar y aceptar' : 'Marcar aceptada'}
                  </MenuItem>
                )}
                {menu.invoice.status !== 'rejected' && (
                  <MenuItem icon={Undo2} onClick={() => cambiarEstado(menu.invoice, 'rejected')}>
                    Marcar rechazada
                  </MenuItem>
                )}
                <MenuSeparator />
                {/* Convertir se ofrece SIEMPRE que no se haya convertido ya:
                    aceptar y convertir son dos gestos distintos, y a veces
                    facturas directamente sin pasar por "aceptada". */}
                <MenuItem
                  icon={FileText}
                  disabled={quotes.estaConvertida(menu.invoice) || esBorrador(menu.invoice.number)}
                  onClick={() => convertir(menu.invoice)}
                >
                  {quotes.estaConvertida(menu.invoice) ? 'Ya convertida' : 'Convertir en factura'}
                </MenuItem>
              </>
            ) : menu.invoice.status === 'paid' ? (
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
        title={`¿Eliminar esta ${v.singular}?`}
        description={
          aBorrar
            ? `Se borrará ${esBorrador(aBorrar.number) ? 'este borrador' : aBorrar.number} y sus líneas. ` +
              'No se puede deshacer, y el número no se reutiliza.'
            : ''
        }
        acciones={
          <>
            <Button onClick={() => setABorrar(null)}>Cancelar</Button>
            <Button variant="danger" icon={Trash2} onClick={borrar}>
              Eliminar
            </Button>
          </>
        }
      />
    </>
  )
}
