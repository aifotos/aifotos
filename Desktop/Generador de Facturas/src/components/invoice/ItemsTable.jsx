import { useCallback, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Picker from '../ui/Picker.jsx'
import Button from '../ui/Button.jsx'
import ServiceDialog from './ServiceDialog.jsx'
import { formatMoney, formatAmount, formatQty, lineTotal, toCents, toMilli } from '../../lib/money.js'
import { lineaVacia } from '../../hooks/useInvoiceDraft.js'
import * as services from '../../db/services.js'

const celda =
  'w-full h-9 px-2 rounded-lg bg-transparent border border-transparent text-sm text-ink ' +
  'placeholder:text-ink-faint transition-colors ' +
  'hover:border-line focus:bg-surface focus:border-brand-400 focus:outline-none ' +
  'focus:ring-2 focus:ring-brand-100'

/**
 * Las lineas de la factura.
 *
 * Cada linea elige un servicio del catalogo o crea uno nuevo en el acto.
 * Antes era texto libre que se "aprendia" al emitir, y eso tenia dos
 * problemas: no sabias si el servicio habia quedado guardado, y cualquier
 * texto a medio escribir podia acabar en el catalogo.
 *
 * La cantidad y el precio si se editan a mano por linea: el precio del
 * catalogo es una referencia, no una atadura.
 */
export default function ItemsTable({ items, moneda, onChange }) {
  const buscar = useCallback((t) => services.search(t, 20), [])
  const [dialogo, setDialogo] = useState(null) // { key, servicio, nombreInicial }
  const [recargar, setRecargar] = useState(0)

  const modificar = (key, cambios) =>
    onChange(items.map((it) => (it.key === key ? { ...it, ...cambios } : it)))

  const agregar = () => onChange([...items, lineaVacia()])

  const quitar = (key) => {
    const restantes = items.filter((it) => it.key !== key)
    // Nunca dejar la tabla sin ninguna linea: no habria donde escribir.
    onChange(restantes.length ? restantes : [lineaVacia()])
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-wide">
        Conceptos
      </h2>

      <div className="rounded-xl border border-line overflow-hidden">
        {/* `minmax(0,1fr)` y no `1fr`. Parece lo mismo y no lo es: `1fr`
            significa `minmax(auto,1fr)`, y ese `auto` impide que la
            columna baje de lo que mida su contenido. Con un nombre de
            servicio largo la columna crecia, empujaba al resto y la fila
            se salia de la caja — que recorta lo que sobra, asi que el
            boton de borrar quedaba fuera, invisible y sin poder pulsarse.
            Con `minmax(0,…)` la columna puede encoger y el texto se corta
            con puntos suspensivos, que es lo que se esperaba desde el
            principio. */}
        <div className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_7rem_2.25rem] gap-2 px-3 py-2
          bg-canvas border-b border-line text-[11px] font-semibold
          text-ink-faint uppercase tracking-wide">
          <span>Descripción</span>
          <span className="text-right">Cant.</span>
          <span className="text-right">Precio</span>
          <span className="text-right">Total</span>
          <span />
        </div>

        <div className="divide-y divide-line">
          {items.map((it) => (
            <ItemRow
              key={it.key}
              item={it}
              moneda={moneda}
              buscar={buscar}
              recargar={recargar}
              onModificar={(c) => modificar(it.key, c)}
              onCrear={(texto) => setDialogo({ key: it.key, servicio: null, nombreInicial: texto })}
              onEditar={async () => {
                const servicio = await services.getById(it.service_id)
                if (servicio) setDialogo({ key: it.key, servicio })
              }}
              onQuitar={() => quitar(it.key)}
              puedeQuitar={items.length > 1 || !!it.description?.trim()}
            />
          ))}
        </div>
      </div>

      <Button size="sm" variant="ghost" icon={Plus} onClick={agregar}>
        Añadir línea
      </Button>

      <ServiceDialog
        abierto={!!dialogo}
        servicio={dialogo?.servicio ?? null}
        nombreInicial={dialogo?.nombreInicial ?? ''}
        moneda={moneda}
        onCerrar={() => setDialogo(null)}
        onGuardado={(s) => {
          modificar(dialogo.key, {
            service_id: s.id,
            description: s.name,
            unit: s.unit,
            unit_price_cents: s.unit_price_cents,
          })
          setRecargar((n) => n + 1)
        }}
      />
    </section>
  )
}

function ItemRow({ item, moneda, buscar, recargar, onModificar, onCrear, onEditar, onQuitar, puedeQuitar }) {
  // Los campos numericos se editan como texto mientras tienen el foco:
  // si se reformatearan en cada tecla, escribir "1500.50" seria imposible
  // (al teclear el punto, el valor volveria a "1500").
  const [editandoCant, setEditandoCant] = useState(null)
  const [editandoPrecio, setEditandoPrecio] = useState(null)
  // El desglose esta escondido hasta que se pide. Una factura de
  // fotografia no lo usa nunca y una de obra lo usa en casi todas las
  // lineas; un campo siempre visible estorbaria a la mitad de los casos.
  const [mostrarDetalle, setMostrarDetalle] = useState(false)
  const hayDetalle = mostrarDetalle || !!item.detail?.trim()

  const total = lineTotal(item.quantity_milli, item.unit_price_cents)

  function elegirServicio(s) {
    onModificar({
      service_id: s.id,
      description: s.name,
      unit: s.unit,
      // Solo se adopta el precio del catalogo si la linea aun no tiene uno,
      // para no pisar un precio que el usuario acaba de escribir a mano.
      unit_price_cents: item.unit_price_cents || s.unit_price_cents,
    })
  }

  return (
    <div className="px-3 py-1.5 group">
     {/* La misma plantilla que la cabecera, y por el mismo motivo:
         ver el comentario de arriba sobre `minmax(0,1fr)`. */}
     <div className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_7rem_2.25rem] gap-2 items-center">
      <Picker
        valor={item.description ? { name: item.description } : null}
        buscar={buscar}
        recargar={recargar}
        onElegir={elegirServicio}
        onCrear={onCrear}
        placeholder="Elige un servicio"
        etiquetaCrear="Crear servicio nuevo"
        className="h-9 rounded-lg border-transparent hover:border-line"
      >
        {(s) => (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink truncate">{s.name}</span>
            <span className="text-xs text-ink-faint tabular-nums whitespace-nowrap">
              {formatMoney(s.unit_price_cents, moneda)}
            </span>
          </div>
        )}
      </Picker>

      <input
        value={editandoCant ?? formatQty(item.quantity_milli)}
        onChange={(e) => setEditandoCant(e.target.value)}
        onFocus={(e) => {
          setEditandoCant(formatQty(item.quantity_milli))
          e.target.select()
        }}
        onBlur={() => {
          onModificar({ quantity_milli: toMilli(editandoCant) })
          setEditandoCant(null)
        }}
        inputMode="decimal"
        className={`${celda} text-right tabular-nums`}
      />

      <input
        value={editandoPrecio ?? formatAmount(item.unit_price_cents)}
        onChange={(e) => setEditandoPrecio(e.target.value)}
        onFocus={(e) => {
          setEditandoPrecio(item.unit_price_cents ? formatAmount(item.unit_price_cents) : '')
          e.target.select()
        }}
        onBlur={() => {
          onModificar({ unit_price_cents: toCents(editandoPrecio) })
          setEditandoPrecio(null)
        }}
        inputMode="decimal"
        placeholder="0.00"
        className={`${celda} text-right tabular-nums`}
      />

      <p className="text-sm text-ink tabular-nums text-right px-2 font-medium">
        {formatAmount(total)}
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

      {item.service_id && <button type="button" onClick={onEditar} className="text-xs text-brand-600 px-2 py-1">Editar servicio del catálogo</button>}
      {hayDetalle ? (
        <textarea
          value={item.detail ?? ''}
          onChange={(e) => onModificar({ detail: e.target.value })}
          onBlur={() => setMostrarDetalle(false)}
          autoFocus={mostrarDetalle && !item.detail}
          rows={2}
          placeholder="Qué incluye — una cosa por línea"
          className="mt-1 w-full px-2 py-1.5 rounded-lg bg-canvas/60 border border-line
            text-xs text-ink-soft placeholder:text-ink-faint resize-y
            focus:outline-none focus:border-brand-400 focus:bg-surface"
        />
      ) : (
        <button
          type="button"
          onClick={() => setMostrarDetalle(true)}
          className="mt-0.5 text-[11px] text-ink-faint hover:text-brand-600
            opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
        >
          + Detalle
        </button>
      )}
    </div>
  )
}
