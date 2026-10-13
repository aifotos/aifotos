import { useCallback, useEffect, useState } from 'react'
import { Users, Mail, Phone, Pencil } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import ClientDialog from '../components/invoice/ClientDialog.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import BotonArchivar, { InterruptorArchivados } from '../components/ui/BotonArchivar.jsx'
import * as clients from '../db/clients.js'

/** Consulta y edición de la agenda de la cuenta actual. */
export default function Clients() {
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState('')
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [verArchivados, setVerArchivados] = useState(false)

  const cargar = useCallback(() => {
    return clients.listAll({ includeArchived: true })
      .then(setLista)
      .catch(e => setError(String(e?.message ?? e)))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function alternarArchivo(c) {
    await (c.archived ? clients.unarchive(c.id) : clients.archive(c.id))
    cargar()
  }

  // Se cargan SIEMPRE todos y se filtra aqui: asi el contador de
  // archivados del interruptor es correcto sin una segunda consulta.
  const archivados = lista.filter(c => c.archived)
  const visibles = verArchivados ? lista : lista.filter(c => !c.archived)

  return (
    <>
      <ClientDialog abierto={!!editando} cliente={editando}
        onCerrar={() => setEditando(null)}
        onGuardado={cliente => setLista(actual => actual.map(c => c.id === cliente.id ? cliente : c).sort((a, b) => a.name.localeCompare(b.name)))} />
      <PageHeader
        title="Clientes"
        subtitle={cargando ? null : `${lista.length - archivados.length} ${lista.length - archivados.length === 1 ? 'cliente' : 'clientes'}`}
        actions={
          (archivados.length > 0 || verArchivados) && (
            <InterruptorArchivados
              activo={verArchivados}
              onCambiar={setVerArchivados}
              n={archivados.length}
            />
          )
        }
      />

      <div className="px-8 py-6">
        {error && <p role="alert" className="text-overdue-ink mb-4">{error}</p>}
        <div className="bg-surface border border-line rounded-card overflow-hidden">
          {!cargando && visibles.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Todavía no hay clientes"
              description="Se crean desde la factura: pulsa «Crear cliente nuevo» en el selector de cliente y aparecerá aquí."
            />
          ) : (
            <div className="divide-y divide-line">
              {visibles.map((c) => (
                <div key={c.id} className={`px-5 py-4 flex items-center gap-4 hover:bg-canvas transition-colors ${c.archived ? 'opacity-50' : ''}`}>
                  <div className="size-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-sm font-semibold shrink-0">
                    {c.name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">
                      {c.name}
                      {/* `=== 1` y no `c.archived &&`: en SQLite esta columna es un
                          entero, y `0 && algo` vale 0 — que React pinta como un
                          «0» pegado al nombre. */}
                      {c.archived === 1 && (
                        <span className="text-xs font-normal text-ink-faint"> · archivado</span>
                      )}
                    </p>
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
                  <Button size="sm" icon={Pencil} onClick={() => setEditando(c)}>Editar cliente</Button>
                  <BotonArchivar archivado={c.archived} nombre={c.name}
                    onAlternar={() => alternarArchivo(c)} />
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-faint leading-relaxed max-w-prose">
          Archivar quita el cliente del selector de las facturas y de esta lista. Sus
          facturas no se tocan: cada una guarda su propia copia de los datos del cliente,
          así que se siguen imprimiendo con los que tenían el día que se emitieron.
        </p>
      </div>
    </>
  )
}
