import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Button from '../ui/Button.jsx'
import { formatAmount, formatQty, toCents, toMilli } from '../../lib/money.js'
import { CATEGORIAS, MARGENES, calcularLinea, formatoMargen } from '../../lib/costeo.js'
import { lineaVacia, margenPorDefecto } from '../../hooks/useCostingDraft.js'

const REJILLA =
  'grid grid-cols-[6rem_minmax(0,1fr)_4.5rem_7rem_6rem_7rem_8rem_8rem_2.25rem] gap-2 items-center'

const celda =
  'w-full h-9 px-2 rounded-lg bg-transparent border border-transparent text-sm text-ink ' +
  'placeholder:text-ink-faint transition-colors ' +
  'hover:border-line focus:bg-surface focus:border-brand-400 focus:outline-none ' +
  'focus:ring-2 focus:ring-brand-100'

/**
 * Las lineas del costeo.
 *
 * Una linea dice lo que te cuesta algo y como se convierte en lo que
 * cobras. El desplegable de precio hace las tres cosas a la vez —elegir
 * margen, cobrar doble o poner un precio cerrado— porque son la misma
 * decision, y separarlas en dos controles obligaria a mirar dos sitios
 * para entender de donde sale un numero.
 */
export default function CostingLines({ lineas, ajustes, calculo, onChange }) {
  const modificar = (key, cambios) =>
    onChange(lineas.map((l) => (l.key === key ? { ...l, ...cambios } : l)))

  const agregar = (category) => onChange([...lineas, lineaVacia(ajustes, category)])

  const quitar = (key) => {
    const restantes = lineas.filter((l) => l.key !== key)
    onChange(restantes.length ? restantes : [lineaVacia(ajustes)])
  }

  return (
    <section className="space-y-2">
      <div className="rounded-xl border border-line overflow-hidden">
        <div className={`${REJILLA} px-3 py-2 bg-canvas border-b border-line
          text-[11px] font-semibold text-ink-faint uppercase tracking-wide`}>
          <span>Tipo</span>
          <span>Descripción</span>
          <span className="text-right">Cant.</span>
          <span className="text-right">Costo</span>
          <span className="text-right">Entrega</span>
          <span>Precio</span>
          <span className="text-right">P. venta</span>
          <span className="text-right">Total</span>
          <span />
        </div>

        <div className="divide-y divide-line">
          {lineas.map((l, i) => (
            <Fila
              key={l.key}
              linea={l}
              calc={calculo.lineas[i]?.calc ?? calcularLinea(l, ajustes)}
              ajustes={ajustes}
              onModificar={(c) => modificar(l.key, c)}
              onQuitar={() => quitar(l.key)}
              puedeQuitar={lineas.length > 1 || !!l.description?.trim()}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" icon={Plus} onClick={() => agregar('labor')}>
          Mano de obra
        </Button>
        <Button size="sm" variant="ghost" icon={Plus} onClick={() => agregar('material')}>
          Material
        </Button>
      </div>
    </section>
  )
}

function Fila({ linea, calc, ajustes, onModificar, onQuitar, puedeQuitar }) {
  // Los campos numericos se editan como texto mientras tienen el foco: si
  // se reformatearan en cada tecla, escribir "1500.50" seria imposible
  // (al teclear el punto, el valor volveria a "1500").
  const [edicion, setEdicion] = useState({})
  const [abierto, setAbierto] = useState(false)

  const hayExtra =
    abierto ||
    !!linea.supplier?.trim() ||
    !!linea.sku?.trim() ||
    linea.real_cost_cents != null ||
    !!linea.double_reason?.trim()

  const campo = (nombre, valor) => ({
    value: edicion[nombre] ?? valor,
    onChange: (e) => setEdicion((d) => ({ ...d, [nombre]: e.target.value })),
    onFocus: (e) => { setEdicion((d) => ({ ...d, [nombre]: valor })); e.target.select() },
  })

  const cerrarMoneda = (nombre, aplicar) => () => {
    aplicar(toCents(edicion[nombre] ?? ''))
    setEdicion((d) => ({ ...d, [nombre]: undefined }))
  }

  const valorPrecio =
    linea.price_mode === 'margin' ? `m:${linea.margin_bp}` : linea.price_mode

  function cambiarPrecio(v) {
    if (v === 'double' || v === 'manual') {
      onModificar({
        price_mode: v,
        // El precio fijo arranca en lo que ya valia con el margen anterior,
        // para no borrar de golpe lo que estaba calculado.
        manual_price_cents:
          v === 'manual' ? (linea.manual_price_cents || calc.precio_empresa_cents) : 0,
      })
    } else {
      onModificar({ price_mode: 'margin', margin_bp: Number(v.slice(2)) })
    }
  }

  const bajoMinimo =
    calc.precio_cents > 0 && calc.margen_bp < margenPorDefecto(ajustes, linea.category)

  return (
    <div className="px-3 py-1.5 group">
      <div className={REJILLA}>
        <select
          value={linea.category}
          onChange={(e) =>
            // Al cambiar de tipo se adopta el margen por defecto del tipo
            // nuevo, salvo que la linea lleve un precio puesto a mano.
            onModificar({
              category: e.target.value,
              margin_bp:
                linea.price_mode === 'margin'
                  ? margenPorDefecto(ajustes, e.target.value)
                  : linea.margin_bp,
            })
          }
          className={`${celda} text-xs`}
        >
          {Object.entries(CATEGORIAS).map(([id, c]) => (
            <option key={id} value={id}>{c.corto}</option>
          ))}
        </select>

        <input
          value={linea.description}
          onChange={(e) => onModificar({ description: e.target.value })}
          placeholder="Qué es"
          className={celda}
        />

        <input
          {...campo('cant', formatQty(linea.quantity_milli))}
          onBlur={() => {
            onModificar({ quantity_milli: toMilli(edicion.cant) })
            setEdicion((d) => ({ ...d, cant: undefined }))
          }}
          inputMode="decimal"
          className={`${celda} text-right tabular-nums`}
        />

        <input
          {...campo('costo', formatAmount(linea.cost_cents))}
          onBlur={cerrarMoneda('costo', (v) => onModificar({ cost_cents: v }))}
          inputMode="decimal"
          placeholder="0.00"
          className={`${celda} text-right tabular-nums`}
        />

        <input
          {...campo('entrega', linea.delivery_cents ? formatAmount(linea.delivery_cents) : '')}
          onBlur={cerrarMoneda('entrega', (v) => onModificar({ delivery_cents: v }))}
          inputMode="decimal"
          placeholder="—"
          title="Transporte o entrega por unidad. Cuenta como costo."
          className={`${celda} text-right tabular-nums`}
        />

        <select value={valorPrecio} onChange={(e) => cambiarPrecio(e.target.value)}
          className={`${celda} text-xs`}>
          {MARGENES.map((bp) => (
            <option key={bp} value={`m:${bp}`}>{formatoMargen(bp)}</option>
          ))}
          <option value="double">Doble</option>
          <option value="manual">Fijo</option>
        </select>

        {linea.price_mode === 'manual' ? (
          <input
            {...campo('manual', formatAmount(linea.manual_price_cents))}
            onBlur={cerrarMoneda('manual', (v) => onModificar({ manual_price_cents: v }))}
            inputMode="decimal"
            className={`${celda} text-right tabular-nums font-medium`}
          />
        ) : (
          <p className="text-sm text-right px-2 tabular-nums font-medium text-ink">
            {formatAmount(calc.precio_cents)}
            <span className={`block text-[10px] font-normal leading-tight
              ${bajoMinimo ? 'text-overdue-ink' : 'text-ink-faint'}`}>
              {formatoMargen(calc.margen_bp)}
            </span>
          </p>
        )}

        <p className="text-sm text-ink tabular-nums text-right px-2 font-medium">
          {formatAmount(calc.total_cents)}
        </p>

        <button
          onClick={onQuitar}
          disabled={!puedeQuitar}
          aria-label="Quitar línea"
          className="size-8 rounded-lg flex items-center justify-center text-ink-faint
            opacity-0 group-hover:opacity-100 focus-visible:opacity-100
            hover:bg-overdue-bg hover:text-overdue-ink transition
            disabled:opacity-0 disabled:pointer-events-none"
        >
          <Trash2 className="size-3.5" strokeWidth={2} />
        </button>
      </div>

      {hayExtra ? (
        <div className="mt-1 grid grid-cols-4 gap-2">
          <Mini etiqueta="Proveedor" valor={linea.supplier}
            onChange={(v) => onModificar({ supplier: v })} />
          <Mini etiqueta="Código" valor={linea.sku}
            onChange={(v) => onModificar({ sku: v })} />
          <Mini
            etiqueta="Costo real"
            valor={linea.real_cost_cents == null ? '' : formatAmount(linea.real_cost_cents)}
            marcador="Cuando se sepa"
            onChange={(v) =>
              // Vacio = NULL, no cero: "todavia no lo he comprado" y "me
              // salio gratis" no son lo mismo, y el informe de variacion
              // depende de poder distinguirlos.
              onModificar({ real_cost_cents: v.trim() === '' ? null : toCents(v) })
            }
          />
          {linea.price_mode === 'double' ? (
            <Mini etiqueta="Motivo del doble" valor={linea.double_reason}
              marcador="Rotura al instalar…"
              onChange={(v) => onModificar({ double_reason: v })} />
          ) : (
            <Variacion linea={linea} calc={calc} />
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="mt-0.5 text-[11px] text-ink-faint hover:text-brand-600
            opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
        >
          + Proveedor, código y costo real
        </button>
      )}
    </div>
  )
}

function Mini({ etiqueta, valor, marcador = '', onChange }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-ink-faint mb-0.5">{etiqueta}</span>
      <input
        value={valor ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={marcador}
        className="w-full h-7 px-2 rounded-lg bg-canvas/60 border border-line
          text-xs text-ink-soft placeholder:text-ink-faint
          focus:outline-none focus:border-brand-400 focus:bg-surface"
      />
    </label>
  )
}

/** Cuanto se desvio el costo real del costeado, en esta linea. */
function Variacion({ linea, calc }) {
  if (linea.real_cost_cents == null || calc.base_cents <= 0) return <span />
  const bp = Math.round(((linea.real_cost_cents - calc.base_cents) / calc.base_cents) * 10000)
  const barato = bp <= 0
  return (
    <div className="self-end pb-1">
      <span className="block text-[10px] text-ink-faint mb-0.5">Variación</span>
      <p className={`text-xs font-medium tabular-nums ${barato ? 'text-paid-ink' : 'text-overdue-ink'}`}>
        {barato ? '' : '+'}{(bp / 100).toFixed(1)} %
        <span className="font-normal text-ink-faint">
          {barato ? ' más barato' : ' más caro'}
        </span>
      </p>
    </div>
  )
}
