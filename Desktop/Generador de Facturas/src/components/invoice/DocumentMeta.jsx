import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Field, { inputClass } from '../ui/Field.jsx'

/**
 * Datos del trabajo que van en el encabezado del documento: donde es,
 * cuando, en que condiciones y quien lo prepara.
 *
 * Viene plegado y solo se despliega si se usa. Son campos de una factura
 * de servicios a domicilio —obra, mantenimiento— y en una de fotografia
 * estan siempre vacios: obligarte a mirarlos en cada factura seria pagar
 * un precio en cada documento por algo que solo hace falta en algunos.
 *
 * Lo que quede vacio tampoco se imprime: el bloque del encabezado solo
 * dibuja las filas que tienen contenido.
 */
export default function DocumentMeta({ borrador, onChange }) {
  const campos = [
    ['service_place', 'Lugar del servicio', 'Tienda Tommy Hilfiger (Ágora Mall)'],
    ['service_date_text', 'Fecha del servicio', 'Por definir'],
    ['credit_terms', 'Condiciones de crédito', '50% adelanto - 50% contra entrega'],
    ['prepared_by', 'Usuario', 'Quién prepara el documento'],
  ]

  const usados = campos.filter(([c]) => String(borrador[c] ?? '').trim()).length
  const [abierto, setAbierto] = useState(usados > 0)

  return (
    <section className="rounded-xl border border-line bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="w-full h-11 px-3 flex items-center justify-between gap-2
          text-left hover:bg-canvas transition-colors"
      >
        <span className="text-xs font-semibold text-ink-faint uppercase tracking-wide">
          Detalles del trabajo
          {usados > 0 && !abierto && (
            <span className="ml-2 normal-case tracking-normal text-ink-soft font-normal">
              {usados} {usados === 1 ? 'campo' : 'campos'}
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-4 text-ink-faint transition-transform ${abierto ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {abierto && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-3">
          {campos.map(([campo, etiqueta, ejemplo]) => (
            <Field key={campo} label={etiqueta}>
              <input
                className={inputClass}
                value={borrador[campo] ?? ''}
                onChange={(e) => onChange({ [campo]: e.target.value })}
                placeholder={ejemplo}
              />
            </Field>
          ))}

          {/* La referencia a la cotizacion no se escribe: la pone la app
              sola al convertir, y es su unica forma de ser fiable. */}
          {borrador.quote_ref && (
            <p className="col-span-2 text-xs text-ink-faint">
              Sale de la cotización <span className="text-ink-soft">{borrador.quote_ref}</span>,
              y así se imprime en el encabezado.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
