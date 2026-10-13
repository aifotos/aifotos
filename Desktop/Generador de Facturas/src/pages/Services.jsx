import { useCallback, useEffect, useState } from 'react'
import ServiceDialog from '../components/invoice/ServiceDialog.jsx'
import Button from '../components/ui/Button.jsx'
import { Package } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import BotonArchivar, { InterruptorArchivados } from '../components/ui/BotonArchivar.jsx'
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
  const [verArchivados, setVerArchivados] = useState(false)

  const cargar = useCallback(() => {
    return services.listAll({ includeArchived: true })
      .then(setLista)
      .catch(e => setError(String(e?.message ?? e)))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function alternarArchivo(s) {
    await (s.archived ? services.unarchive(s.id) : services.archive(s.id))
    cargar()
  }

  // Se cargan SIEMPRE todos y se filtra aqui: asi el contador de
  // archivados del interruptor es correcto sin una segunda consulta.
  const archivados = lista.filter(s => s.archived)
  const visibles = verArchivados ? lista : lista.filter(s => !s.archived)

  return (
    <>
      <PageHeader
        title="Servicios"
        actions={
          <>
            {(archivados.length > 0 || verArchivados) && (
              <InterruptorArchivados
                activo={verArchivados}
                onCambiar={setVerArchivados}
                n={archivados.length}
              />
            )}
            <Button variant="primary" onClick={() => setEditing({})}>Nuevo servicio</Button>
          </>
        }
        subtitle={cargando ? null : `${lista.length - archivados.length} en el catálogo`}
      />

      {error && <p role="alert">{error}</p>}
      <ServiceDialog abierto={!!editing} servicio={editing?.id ? editing : null} moneda={moneda} onCerrar={() => setEditing(null)} onGuardado={() => services.listAll().then(setLista).catch(e => setError(String(e)))} />
      <div className="px-8 py-6">
        <div className="bg-surface border border-line rounded-card overflow-hidden">
          {!cargando && visibles.length === 0 ? (
            <EmptyState
              icon={Package}
              title="El catálogo está vacío"
              description="Se crean desde la factura: pulsa «Crear servicio nuevo» en una línea y quedará guardado aquí."
            />
          ) : (
            <div className="divide-y divide-line">
              {visibles.map((s) => (
                <div key={s.id} className={`px-5 py-4 flex items-center gap-4 hover:bg-canvas transition-colors ${s.archived ? 'opacity-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">
                      {s.name}
                      {/* `=== 1` y no `s.archived &&`: en SQLite esta columna es un
                          entero, y `0 && algo` vale 0 — que React pinta como un
                          «0» pegado al nombre. */}
                      {s.archived === 1 && (
                        <span className="text-xs font-normal text-ink-faint"> · archivado</span>
                      )}
                    </p>
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
                  <BotonArchivar archivado={s.archived} nombre={s.name}
                    onAlternar={() => alternarArchivo(s)} />
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-faint leading-relaxed max-w-prose">
          Archivar quita el servicio del selector de las facturas y de esta lista. Las
          facturas que ya lo usaron no se tocan: cada línea guarda su propia descripción
          y su precio, así que se siguen imprimiendo igual.
        </p>
      </div>
    </>
  )
}
