import { useState } from 'react'
import { formatAmount, formatMoney, toCents } from '../../lib/money.js'

/**
 * Subtotal, descuento y total.
 *
 * El descuento admite dos formas y se guardan distinto: como importe fijo
 * son centavos (50000 = RD$ 500.00); como porcentaje son centesimas de
 * punto (1000 = 10.00 %). Enteros en ambos casos, sin decimales flotantes.
 */
export default function TotalsSection({ borrador, totales, moneda, onChange }) {
  const [editando, setEditando] = useState(null)
  const esPorcentaje = borrador.discount_type === 'percent'
  const hayDescuento = borrador.discount_type !== 'none'

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

  return (
    <section className="ml-auto w-full max-w-xs space-y-2">
      <Fila etiqueta="Subtotal" valor={formatMoney(totales.subtotal_cents, moneda)} />

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

      <div className="pt-2 border-t border-line flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Total</span>
        <span className="text-xl font-semibold text-ink tabular-nums tracking-tight">
          {formatMoney(totales.total_cents, moneda)}
        </span>
      </div>
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
