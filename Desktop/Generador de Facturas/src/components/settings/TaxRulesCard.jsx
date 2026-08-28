import { useCallback, useEffect, useState } from 'react'
import { ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react'
import Button from '../ui/Button.jsx'
import TaxRuleDialog from '../invoice/TaxRuleDialog.jsx'
import { formatMoney } from '../../lib/money.js'
import * as taxes from '../../db/taxes.js'

/**
 * El catalogo de impuestos y retenciones de la cuenta.
 *
 * Aqui solo se DEFINEN. Aplicarlas es cosa de cada documento, y esa
 * separacion es el punto: tener el ITBIS creado no significa cobrarlo
 * siempre. Un cliente residencial no lleva ninguno y una empresa que
 * retiene lleva tres, con las mismas reglas de este catalogo.
 */
export default function TaxRulesCard({ moneda }) {
  const [reglas, setReglas] = useState(null)
  const [dialogo, setDialogo] = useState(null)

  const cargar = useCallback(() => {
    taxes.listar({ includeArchived: true }).then(setReglas)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function alternarArchivo(r) {
    await (r.archived ? taxes.desarchivar(r.id) : taxes.archivar(r.id))
    cargar()
  }

  return (
    <section className="bg-surface border border-line rounded-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Impuestos y retenciones</h2>
          <p className="mt-0.5 text-xs text-ink-faint leading-relaxed">
            Se definen aquí y se aplican factura por factura, solo cuando hacen falta.
          </p>
        </div>
        <Button
          size="sm"
          icon={Plus}
          onClick={() => setDialogo({ regla: null })}
        >
          Nueva
        </Button>
      </div>

      {reglas?.length === 0 && (
        <p className="text-xs text-ink-faint py-2">
          Todavía no hay ninguna. Si facturas sin impuestos, así está bien.
        </p>
      )}

      {reglas?.length > 0 && (
        <ul className="divide-y divide-line -mx-2">
          {reglas.map((r) => (
            <li
              key={r.id}
              className={`px-2 py-2.5 flex items-center gap-3 group
                ${r.archived ? 'opacity-50' : ''}`}
            >
              <span
                className={`size-6 shrink-0 rounded-lg flex items-center justify-center
                  text-sm font-semibold
                  ${r.kind === 'tax' ? 'bg-paid-bg text-paid-ink' : 'bg-overdue-bg text-overdue-ink'}`}
                title={taxes.TIPOS[r.kind].label}
              >
                {taxes.TIPOS[r.kind].signo}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate">
                  {r.name}
                  {r.archived && <span className="text-xs text-ink-faint"> · archivada</span>}
                </p>
                <p className="text-xs text-ink-faint truncate">
                  {r.base === 'fixed'
                    ? formatMoney(r.rate_bp, moneda)
                    : `${taxes.formatoTasa(r)} ${taxes.BASES[r.base].label.toLowerCase()}`}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0 opacity-0
                group-hover:opacity-100 focus-within:opacity-100 transition">
                <button
                  onClick={() => setDialogo({ regla: r })}
                  aria-label={`Editar ${r.name}`}
                  className="size-8 rounded-lg flex items-center justify-center
                    text-ink-faint hover:text-ink hover:bg-canvas transition-colors"
                >
                  <Pencil className="size-3.5" strokeWidth={2} />
                </button>
                <button
                  onClick={() => alternarArchivo(r)}
                  aria-label={r.archived ? `Recuperar ${r.name}` : `Archivar ${r.name}`}
                  className="size-8 rounded-lg flex items-center justify-center
                    text-ink-faint hover:text-ink hover:bg-canvas transition-colors"
                >
                  {r.archived
                    ? <ArchiveRestore className="size-3.5" strokeWidth={2} />
                    : <Trash2 className="size-3.5" strokeWidth={2} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-ink-faint leading-relaxed">
        Archivar una regla no toca las facturas que ya la usaron: cada documento guarda su
        propia copia con la tasa que tenía el día que se emitió.
      </p>

      <TaxRuleDialog
        abierto={!!dialogo}
        regla={dialogo?.regla ?? null}
        moneda={moneda}
        onCerrar={() => setDialogo(null)}
        onGuardado={cargar}
      />
    </section>
  )
}
