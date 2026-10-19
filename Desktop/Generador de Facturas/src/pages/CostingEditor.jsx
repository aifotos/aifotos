import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, Cloud, CloudOff, Copy, FileSignature, Loader2 } from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import Picker from '../components/ui/Picker.jsx'
import Field, { inputClass, textareaClass } from '../components/ui/Field.jsx'
import CostingLines from '../components/costing/CostingLines.jsx'
import useCostingDraft from '../hooks/useCostingDraft.js'
import { formatMoney } from '../lib/money.js'
import { calcularCosteo, formatoMargen } from '../lib/costeo.js'
import * as clients from '../db/clients.js'
import * as costings from '../db/costings.js'
import { esBorrador } from '../db/settings.js'

/**
 * Editor de costeos.
 *
 * Ocupa la ventana entera y no lleva vista previa, a diferencia del editor
 * de facturas. No es un descuido: un costeo NO se imprime nunca. Lo que ve
 * el cliente es la cotizacion que sale de el, y ahi solo viaja el precio.
 */
export default function CostingEditor({ ajustes, costeoId, onSalir, onAbrirCotizacion }) {
  const { borrador, actualizar, guardarAhora, totales, estadoGuardado, cargando } =
    useCostingDraft({ ajustes, costeoId })
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [dialogo, setDialogo] = useState(false)
  const [registrarCostos, setRegistrarCostos] = useState(true)
  const [error, setError] = useState(null)

  const buscarCliente = useCallback((t) => clients.search(t, 20), [])

  // Los dos escenarios a la vez. Ver el otro numero al lado es lo que
  // convierte "a quien le cotizo" en una decision y no en una casilla.
  const comparacion = useMemo(() => {
    if (!borrador) return null
    const base = {
      margin_secondary_bp: ajustes.margin_secondary_bp,
      rounding_primary_cents: ajustes.rounding_primary_cents,
      rounding_secondary_cents: ajustes.rounding_secondary_cents,
      discount_mode: borrador.discount_mode,
      discount_bp: borrador.discount_bp,
    }
    return {
      business: calcularCosteo(borrador.lineas, { ...base, price_mode: 'business' }),
      residential: calcularCosteo(borrador.lineas, { ...base, price_mode: 'residential' }),
    }
  }, [borrador, ajustes])

  if (cargando || !borrador) {
    return (
      <div className="h-full flex items-center justify-center text-ink-soft">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  const yaConvertido = borrador.quote_id != null

  async function duplicar() {
    await guardarAhora(borrador)
    if (borrador.id) await costings.duplicate(borrador.id)
    onSalir()
  }

  async function convertir() {
    setConvirtiendo(true)
    setError(null)
    try {
      const guardado = await guardarAhora(borrador)
      const id = guardado?.id ?? borrador.id
      if (!id) throw new Error('Guarda el costeo antes de convertirlo')
      const cot = await costings.convertirEnCotizacion(id, { registrarCostos })
      setDialogo(false)
      onAbrirCotizacion?.(cot)
    } catch (e) {
      setError(String(e?.message ?? e))
    } finally {
      setConvirtiendo(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 bg-canvas/85 backdrop-blur-xl border-b border-line">
        <div className="px-6 pt-11 pb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onSalir}>
              Costeos
            </Button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">
                {borrador.title?.trim() || borrador.number || 'Costeo nuevo'}
              </p>
              <IndicadorGuardado estado={estadoGuardado} />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button icon={Copy} onClick={duplicar} disabled={!borrador.id}>
              Duplicar
            </Button>
            {yaConvertido ? (
              <span className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl
                bg-paid-bg text-paid-ink text-sm font-medium">
                <FileSignature className="size-4" />
                {esBorrador(borrador.quote_number) ? 'Cotización creada' : borrador.quote_number}
              </span>
            ) : (
              <Button
                variant="primary"
                icon={FileSignature}
                onClick={() => setDialogo(true)}
                disabled={totales.total_cents <= 0}
              >
                Generar cotización
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
          {error && (
            <p className="rounded-xl bg-overdue-bg text-overdue-ink text-sm px-4 py-3">{error}</p>
          )}

          <section className="grid grid-cols-4 gap-3">
            <Field label="Obra o trabajo" className="col-span-2">
              <input className={inputClass} value={borrador.title}
                onChange={(e) => actualizar({ title: e.target.value })}
                placeholder="Techado garita de seguridad" />
            </Field>
            <Field label="Cliente">
              <Picker
                valor={borrador.client_name ? { name: borrador.client_name } : null}
                buscar={buscarCliente}
                onElegir={(c) => actualizar({ client_name: c.name })}
                onCrear={(t) => actualizar({ client_name: t })}
                placeholder="Elige un cliente"
                etiquetaCrear="Dejar solo el nombre escrito"
              >
                {(c) => <p className="text-sm text-ink truncate">{c.name}</p>}
              </Picker>
            </Field>
            <Field label="Fecha">
              <input type="date" className={inputClass} value={borrador.issue_date}
                onChange={(e) => actualizar({ issue_date: e.target.value })} />
            </Field>
            <Field label="Proveedor">
              <input className={inputClass} value={borrador.supplier}
                onChange={(e) => actualizar({ supplier: e.target.value })}
                placeholder="Ochoa" />
            </Field>
            <Field label="Su cotización" hint="El número que te dio el proveedor">
              <input className={inputClass} value={borrador.supplier_ref}
                onChange={(e) => actualizar({ supplier_ref: e.target.value })}
                placeholder="00012" />
            </Field>
            <Field label="A quién se le cotiza" className="col-span-2">
              <div className="grid grid-cols-2 gap-2">
                <Destinatario
                  activo={borrador.price_mode === 'business'}
                  onClick={() => actualizar({ price_mode: 'business' })}
                  titulo="Empresa"
                  ayuda="Precio tal cual sale del cálculo"
                  total={comparacion?.business.total_cents}
                  moneda={ajustes.currency_symbol}
                />
                <Destinatario
                  activo={borrador.price_mode === 'residential'}
                  onClick={() => actualizar({ price_mode: 'residential' })}
                  titulo="Residencial"
                  ayuda={`Margen ${formatoMargen(ajustes.margin_secondary_bp)}, redondeado`}
                  total={comparacion?.residential.total_cents}
                  moneda={ajustes.currency_symbol}
                />
              </div>
            </Field>
          </section>

          <CostingLines
            lineas={borrador.lineas}
            ajustes={{ ...ajustes, price_mode: borrador.price_mode }}
            calculo={totales}
            onChange={(lineas) => actualizar({ lineas })}
          />

          <div className="grid grid-cols-2 gap-6 items-start">
            <Field label="Notas internas" hint="No salen en la cotización">
              <textarea className={textareaClass} value={borrador.notes}
                onChange={(e) => actualizar({ notes: e.target.value })}
                placeholder="Quién dio el precio, qué falta por confirmar…" />
            </Field>

            <Resumen
              borrador={borrador}
              totales={totales}
              moneda={ajustes.currency_symbol}
              onChange={actualizar}
            />
          </div>
        </div>
      </div>

      <Modal
        abierto={dialogo}
        onCerrar={() => setDialogo(false)}
        title="Generar la cotización"
        description={`Se creará como borrador, con el precio ${
          borrador.price_mode === 'business' ? 'de empresa' : 'residencial'
        }: ${formatMoney(totales.total_cents, ajustes.currency_symbol)}. Ni el costo ni el margen salen en ella.`}
        ancho="max-w-md"
        acciones={
          <>
            <Button onClick={() => setDialogo(false)}>Cancelar</Button>
            <Button variant="primary" onClick={convertir} disabled={convirtiendo}>
              {convirtiendo ? 'Generando…' : 'Generar'}
            </Button>
          </>
        }
      >
        <label className="flex items-start gap-2.5 text-left cursor-default">
          <input
            type="checkbox"
            checked={registrarCostos}
            onChange={(e) => setRegistrarCostos(e.target.checked)}
            className="mt-0.5 size-4 accent-brand-600"
          />
          <span className="text-sm text-ink-soft leading-relaxed">
            Apuntar los costos como <strong className="text-ink">previstos</strong> en Costos y
            gastos. Luego, al registrar lo que pagaste de verdad, la comparación sale sola.
          </span>
        </label>
      </Modal>
    </div>
  )
}

function Destinatario({ activo, onClick, titulo, ayuda, total, moneda }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-auto py-2 px-3 rounded-xl border text-left transition-colors
        ${activo ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100' : 'border-line bg-surface hover:bg-canvas'}`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{titulo}</span>
        <span className="text-sm tabular-nums text-ink">{formatMoney(total ?? 0, moneda)}</span>
      </span>
      <span className="block text-xs text-ink-faint leading-snug">{ayuda}</span>
    </button>
  )
}

/** Lo que cuesta, lo que se cobra y lo que queda. */
function Resumen({ borrador, totales, moneda, onChange }) {
  const [editando, setEditando] = useState(null)

  return (
    <section className="rounded-xl border border-line bg-surface p-4 space-y-2">
      <Fila etiqueta="Te cuesta" valor={formatMoney(totales.costo_cents, moneda)} apagado />
      <Fila etiqueta="Precio de venta" valor={formatMoney(totales.bruto_cents, moneda)} />

      <div className="flex items-center justify-between gap-2">
        <select
          value={borrador.discount_mode}
          onChange={(e) => onChange({ discount_mode: e.target.value, discount_bp: 0 })}
          className="h-7 text-sm text-ink-soft bg-transparent border-none
            focus:outline-none cursor-default"
        >
          <option value="none">Sin descuento</option>
          <option value="policy">Descuento por política</option>
          <option value="manual">Descuento %</option>
        </select>
        {borrador.discount_mode === 'manual' && (
          <input
            value={editando ?? String(borrador.discount_bp / 100)}
            onChange={(e) => setEditando(e.target.value)}
            onFocus={() => setEditando(String(borrador.discount_bp / 100))}
            onBlur={() => {
              const n = Math.round(parseFloat((editando ?? '0').replace(',', '.') || '0') * 100)
              onChange({ discount_bp: Math.min(10000, Math.max(0, Number.isFinite(n) ? n : 0)) })
              setEditando(null)
            }}
            inputMode="decimal"
            className="w-14 h-7 px-2 rounded-lg border border-line bg-surface
              text-sm text-ink text-right tabular-nums focus:outline-none focus:border-brand-400"
          />
        )}
        <span className="text-sm text-ink-soft tabular-nums ml-auto">
          {totales.descuento_cents > 0
            ? `−${formatMoney(totales.descuento_cents, moneda)}`
            : '—'}
        </span>
      </div>
      {borrador.discount_mode === 'policy' && (
        <p className="text-[11px] text-ink-faint -mt-1">
          {formatoMargen(totales.descuento_bp)} por el tamaño del presupuesto
        </p>
      )}

      <div className="pt-2 border-t border-line flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Le cobras</span>
        <span className="text-xl font-semibold text-ink tabular-nums tracking-tight">
          {formatMoney(totales.total_cents, moneda)}
        </span>
      </div>

      <div className="pt-2 flex items-center justify-between">
        <span className="text-sm text-ink-soft">Ganas</span>
        <span className="text-sm font-semibold text-paid-ink tabular-nums">
          {formatMoney(totales.ganancia_cents, moneda)}
          <span className="font-normal text-ink-faint"> · {formatoMargen(totales.margen_bp)}</span>
        </span>
      </div>

      {totales.n_con_real > 0 && <Variacion totales={totales} moneda={moneda} />}
    </section>
  )
}

/**
 * Lo costeado contra lo que costo de verdad.
 *
 * Es la parte que en el Excel estaba y no se miraba, y la mas util: si
 * mes tras mes el costo real cae sistematicamente por debajo del
 * costeado, no estas teniendo suerte — estas costeando con precios viejos
 * y cotizando mas caro de lo que necesitas.
 */
function Variacion({ totales, moneda }) {
  const barato = totales.variacion_cents <= 0
  return (
    <div className="pt-3 mt-1 border-t border-line">
      <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wide mb-1.5">
        Costo real · {totales.n_con_real} {totales.n_con_real === 1 ? 'línea' : 'líneas'}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">Costeaste</span>
        <span className="text-sm tabular-nums text-ink">
          {formatMoney(totales.costo_previsto_cents, moneda)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">Pagaste</span>
        <span className="text-sm tabular-nums text-ink">
          {formatMoney(totales.costo_real_cents, moneda)}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-sm text-ink-soft">Diferencia</span>
        <span className={`text-sm font-semibold tabular-nums ${barato ? 'text-paid-ink' : 'text-overdue-ink'}`}>
          {barato ? '' : '+'}{formatMoney(totales.variacion_cents, moneda)}
          <span className="font-normal text-ink-faint">
            {' '}· {barato ? '' : '+'}{(totales.variacion_bp / 100).toFixed(1)} %
          </span>
        </span>
      </div>
    </div>
  )
}

function Fila({ etiqueta, valor, apagado }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-soft">{etiqueta}</span>
      <span className={`text-sm tabular-nums ${apagado ? 'text-ink-faint' : 'text-ink'}`}>
        {valor}
      </span>
    </div>
  )
}

function IndicadorGuardado({ estado }) {
  const contenido = {
    guardando: [Loader2, 'Guardando…', 'animate-spin'],
    guardado: [Cloud, 'Guardado', ''],
    error: [CloudOff, 'No se pudo guardar', ''],
  }[estado]
  if (!contenido) return <p className="text-xs text-ink-faint">Sin guardar</p>
  const [Icono, texto, clase] = contenido
  return (
    <p className={`flex items-center gap-1 text-xs ${estado === 'error' ? 'text-overdue-ink' : 'text-ink-faint'}`}>
      <Icono className={`size-3 ${clase}`} /> {texto}
    </p>
  )
}
