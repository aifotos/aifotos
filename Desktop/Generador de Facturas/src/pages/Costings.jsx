import { useCallback, useEffect, useState } from 'react'
import { Calculator, FileSignature, Plus, Trash2 } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Modal from '../components/ui/Modal.jsx'
import { formatMoney } from '../lib/money.js'
import { formatDateShort } from '../lib/dates.js'
import { formatoMargen } from '../lib/costeo.js'
import { esBorrador } from '../db/settings.js'
import * as costings from '../db/costings.js'

/**
 * Listado de costeos.
 *
 * Ensena en cada fila lo que importa de un vistazo: lo que te cuesta, lo
 * que cobras y cuanto queda en medio. El margen va al lado del total
 * porque un costeo con buen total y mal margen se ve igual que uno bueno
 * hasta que haces la resta.
 */
export default function Costings({ moneda = 'RD$', onAbrir, onNuevo }) {
  const [lista, setLista] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [borrando, setBorrando] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    return Promise.all([costings.list({ search: busqueda }), costings.summary()])
      .then(([l, r]) => { setLista(l); setResumen(r) })
      .catch((e) => setError(String(e?.message ?? e)))
  }, [busqueda])

  useEffect(() => { cargar() }, [cargar])

  async function borrar() {
    await costings.remove(borrando.id)
    setBorrando(null)
    cargar()
  }

  return (
    <>
      <PageHeader
        title="Costeos"
        subtitle={
          resumen
            ? `${resumen.n} ${resumen.n === 1 ? 'costeo' : 'costeos'} · ${formatMoney(resumen.ganancia, moneda)} de ganancia prevista`
            : null
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={onNuevo}>
            Nuevo costeo
          </Button>
        }
      />

      <div className="px-8 py-6 space-y-4">
        {error && <p role="alert" className="text-overdue-ink text-sm">{error}</p>}

        {(lista?.length > 0 || busqueda) && (
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por obra, cliente o número…"
            className="w-full max-w-sm h-9 px-3 rounded-xl bg-surface border border-line
              text-sm text-ink placeholder:text-ink-faint
              focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        )}

        <div className="bg-surface border border-line rounded-card overflow-hidden">
          {lista?.length === 0 ? (
            <EmptyState
              icon={Calculator}
              title={busqueda ? 'Nada coincide' : 'Todavía no hay costeos'}
              description={
                busqueda
                  ? 'Prueba con otra palabra.'
                  : 'Un costeo parte de lo que te cuesta un trabajo y llega al precio que le pones al cliente. De ahí sale la cotización con un clic.'
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {(lista ?? []).map((c) => (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onAbrir(c)}
                  onKeyDown={(e) =>
                    (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onAbrir(c))
                  }
                  className="group grid grid-cols-[7rem_minmax(0,1fr)_auto_auto_2rem]
                    items-center gap-4 px-5 h-16 cursor-default transition-colors
                    hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink tabular-nums">{c.number}</p>
                    <p className="text-xs text-ink-faint">{formatDateShort(c.issue_date)}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">
                      {c.title?.trim() || <span className="text-ink-faint">Sin título</span>}
                    </p>
                    <p className="text-xs text-ink-faint truncate">
                      {c.client_name || 'Sin cliente'} · {c.line_count}{' '}
                      {c.line_count === 1 ? 'línea' : 'líneas'}
                    </p>
                  </div>

                  {c.quote_number ? (
                    <span className="inline-flex items-center gap-1 text-xs rounded-lg
                      bg-paid-bg text-paid-ink px-2 py-1 whitespace-nowrap">
                      {/* Un borrador lleva un numero interno ('BOR-0003')
                          que solo existe para la restriccion UNIQUE.
                          Ensenarlo confundiria: no es un numero real y
                          nunca sale en un PDF. */}
                      <FileSignature className="size-3" />
                      {esBorrador(c.quote_number) ? 'Cotizada' : c.quote_number}
                    </span>
                  ) : (
                    <span />
                  )}

                  <div className="text-right whitespace-nowrap">
                    <p className="text-sm font-semibold text-ink tabular-nums">
                      {formatMoney(c.total_cents, moneda)}
                    </p>
                    <p className="text-xs text-ink-faint tabular-nums">
                      cuesta {formatMoney(c.cost_cents, moneda)} ·{' '}
                      {formatoMargen(
                        c.total_cents > 0
                          ? Math.round(((c.total_cents - c.cost_cents) / c.total_cents) * 10000)
                          : 0,
                      )}
                    </p>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); setBorrando(c) }}
                    aria-label={`Borrar ${c.number}`}
                    className="size-8 rounded-lg flex items-center justify-center text-ink-faint
                      opacity-0 group-hover:opacity-100 focus-visible:opacity-100
                      hover:bg-overdue-bg hover:text-overdue-ink transition"
                  >
                    <Trash2 className="size-3.5" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        abierto={!!borrando}
        onCerrar={() => setBorrando(null)}
        title={`¿Borrar ${borrando?.number}?`}
        description={
          borrando?.quote_number
            ? `La cotización que salió de aquí NO se borra: se queda, pero pierde el rastro de cómo se calculó.`
            : 'Se borra el costeo y todas sus líneas. No se puede deshacer.'
        }
        acciones={
          <>
            <Button onClick={() => setBorrando(null)}>Cancelar</Button>
            <Button variant="danger" icon={Trash2} onClick={borrar}>Borrar</Button>
          </>
        }
      />
    </>
  )
}
