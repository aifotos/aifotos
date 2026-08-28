import { useCallback, useState } from 'react'
import { X } from 'lucide-react'
import Picker from '../ui/Picker.jsx'
import TaxRuleDialog from './TaxRuleDialog.jsx'
import { formatAmount, formatMoney, toCents } from '../../lib/money.js'
import * as taxes from '../../db/taxes.js'

/**
 * La liquidacion del documento: bruto, descuento, impuestos, retenciones
 * y el importe neto.
 *
 * Sigue el mismo orden que se imprime, y a proposito: si aqui las
 * retenciones aparecieran antes que los impuestos, tendrias que
 * reordenarlas mentalmente cada vez que compruebas que la factura cuadra.
 *
 * Los impuestos no vienen puestos de serie aunque los tengas en el
 * catalogo. Hay clientes que retienen y clientes que no, y una casilla que
 * ya viene marcada se pasa por alto mucho mas facil que una que falta.
 */
export default function TotalsSection({ borrador, totales, moneda, onChange }) {
  const [editando, setEditando] = useState(null)
  const [dialogo, setDialogo] = useState(null)
  const [recargar, setRecargar] = useState(0)

  const esPorcentaje = borrador.discount_type === 'percent'
  const hayDescuento = borrador.discount_type !== 'none'
  const aplicados = borrador.adjustments ?? []

  // Las reglas ya aplicadas no se ofrecen otra vez: sumar dos veces el
  // mismo ITBIS es un error que no tiene ningun uso legitimo.
  //
  // La dependencia es una CADENA con los ids, no el array. Con el array,
  // `buscar` cambiaria de identidad en cada renderizado, el efecto que la
  // llama dentro del Picker volveria a dispararse, ese efecto pinta y
  // vuelve a renderizar: un bucle infinito con la lista abierta.
  const idsAplicados = aplicados.map((a) => a.rule_id).filter(Boolean).join(',')
  const buscar = useCallback(
    async (t) => {
      const puestas = new Set(idsAplicados.split(',').filter(Boolean).map(Number))
      const todas = await taxes.listar()
      const texto = t.trim().toLowerCase()
      return todas.filter(
        (r) => !puestas.has(r.id) && (!texto || r.name.toLowerCase().includes(texto)),
      )
    },
    [idsAplicados],
  )

  function valorMostrado() {
    if (editando !== null) return editando
    if (!hayDescuento) return ''
    return esPorcentaje
      ? String(borrador.discount_value / 100)
      : formatAmount(borrador.discount_value)
  }

  function confirmarValor() {
    const texto = editando ?? ''
    const valor = esPorcentaje
      ? Math.min(10000, Math.max(0, Math.round(parseFloat(texto.replace(',', '.') || '0') * 100)))
      : toCents(texto)
    onChange({ discount_value: Number.isFinite(valor) ? valor : 0 })
    setEditando(null)
  }

  function cambiarTipo(tipo) {
    // Al cambiar de importe a porcentaje el numero significa otra cosa
    // (500 centavos no son 500 %), asi que se reinicia en lugar de
    // reinterpretarse.
    onChange({ discount_type: tipo, discount_value: 0 })
    setEditando(null)
  }

  /**
   * Aplica una regla al documento como COPIA, no como referencia.
   *
   * Si manana editas el ITBIS en el catalogo, este documento conserva la
   * tasa con la que se hizo. Es la misma decision que congelar los datos
   * del cliente en la factura.
   */
  function aplicar(regla) {
    onChange({
      adjustments: [
        ...aplicados,
        {
          key: crypto.randomUUID(),
          rule_id: regla.id,
          name: regla.name,
          kind: regla.kind,
          base: regla.base,
          rate_bp: regla.rate_bp,
        },
      ],
    })
  }

  const quitar = (a) =>
    onChange({ adjustments: aplicados.filter((x) => (x.key ?? x.id) !== (a.key ?? a.id)) })

  return (
    <section className="ml-auto w-full max-w-xs space-y-2">
      <Fila etiqueta="Importe bruto" valor={formatMoney(totales.subtotal_cents, moneda)} />

      {hayDescuento ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <select
              value={borrador.discount_type}
              onChange={(e) => cambiarTipo(e.target.value)}
              className="h-7 text-sm text-ink-soft bg-transparent border-none
                focus:outline-none cursor-default"
            >
              <option value="none">Sin descuento</option>
              <option value="amount">Descuento</option>
              <option value="percent">Descuento %</option>
            </select>
            <input
              value={valorMostrado()}
              onChange={(e) => setEditando(e.target.value)}
              onFocus={() => setEditando(valorMostrado())}
              onBlur={confirmarValor}
              inputMode="decimal"
              placeholder="0"
              className="w-16 h-7 px-2 rounded-lg border border-line bg-surface
                text-sm text-ink text-right tabular-nums
                focus:outline-none focus:border-brand-400"
            />
          </div>
          <span className="text-sm text-ink-soft tabular-nums">
            −{formatMoney(totales.discount_cents, moneda)}
          </span>
        </div>
      ) : (
        <button
          onClick={() => cambiarTipo('percent')}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          Añadir descuento
        </button>
      )}

      {totales.impuestos.map((a) => (
        <Ajuste key={a.key ?? a.id} ajuste={a} moneda={moneda} onQuitar={() => quitar(a)} />
      ))}

      {/* El subtotal intermedio solo tiene sentido si hay algo que sumar
          por encima; si no, repetiria el importe bruto. */}
      {totales.impuestos.length > 0 && (
        <Fila
          etiqueta="Subtotal"
          valor={formatMoney(totales.base_cents + totales.tax_cents, moneda)}
        />
      )}

      {totales.retenciones.map((a) => (
        <Ajuste key={a.key ?? a.id} ajuste={a} moneda={moneda} onQuitar={() => quitar(a)} />
      ))}

      <Picker
        valor={null}
        buscar={buscar}
        recargar={recargar}
        onElegir={aplicar}
        onCrear={(texto) => setDialogo({ regla: null, nombreInicial: texto })}
        placeholder="Añadir impuesto o retención"
        etiquetaCrear="Crear impuesto o retención"
        className="h-9 text-[13px]"
      >
        {(r) => (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink truncate">
              <span className={r.kind === 'tax' ? 'text-paid-ink' : 'text-overdue-ink'}>
                {taxes.TIPOS[r.kind].signo}
              </span>{' '}
              {r.name}
            </span>
            <span className="text-xs text-ink-faint tabular-nums whitespace-nowrap">
              {r.base === 'fixed' ? formatMoney(r.rate_bp, moneda) : taxes.formatoTasa(r)}
              {r.base === 'taxes' && ' del ITBIS'}
            </span>
          </div>
        )}
      </Picker>

      <div className="pt-2 border-t border-line flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Importe neto</span>
        <span className="text-xl font-semibold text-ink tabular-nums tracking-tight">
          {formatMoney(totales.total_cents, moneda)}
        </span>
      </div>

      <TaxRuleDialog
        abierto={!!dialogo}
        regla={dialogo?.regla ?? null}
        nombreInicial={dialogo?.nombreInicial ?? ''}
        moneda={moneda}
        onCerrar={() => setDialogo(null)}
        onGuardado={(r) => {
          // Se crea y se aplica de una vez: si has abierto el formulario
          // desde la factura, es porque la quieres en ESTA factura.
          aplicar(r)
          setRecargar((n) => n + 1)
        }}
      />
    </section>
  )
}

function Fila({ etiqueta, valor }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-soft">{etiqueta}</span>
      <span className="text-sm text-ink tabular-nums">{valor}</span>
    </div>
  )
}

function Ajuste({ ajuste, moneda, onQuitar }) {
  const resta = ajuste.kind === 'retention'
  return (
    <div className="flex items-center justify-between gap-2 group">
      <span className="text-sm text-ink-soft truncate flex items-center gap-1">
        <button
          onClick={onQuitar}
          aria-label={`Quitar ${ajuste.name}`}
          className="size-4 rounded shrink-0 flex items-center justify-center text-ink-faint
            opacity-0 group-hover:opacity-100 focus-visible:opacity-100
            hover:text-overdue-ink transition"
        >
          <X className="size-3" strokeWidth={2.5} />
        </button>
        <span className="truncate">{ajuste.name}</span>
      </span>
      <span className="text-sm text-ink-soft tabular-nums whitespace-nowrap">
        {resta ? '−' : '+'}
        {formatMoney(ajuste.amount_cents, moneda)}
      </span>
    </div>
  )
}
