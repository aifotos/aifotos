import Field, { inputClass, textareaClass } from '../ui/Field.jsx'

/** Datos del trabajo, visibles tanto en facturas como en cotizaciones. */
export default function DocumentMeta({ borrador, onChange }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 space-y-3">
      <div>
        <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-wide">
          Lugar y datos del trabajo
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          Aparecen a la izquierda de los datos del cliente, en la vista previa y en el PDF.
        </p>
      </div>

      <Field label="Lugar del servicio" hint="Nombre del local, dirección o sucursales. Puedes usar varias líneas.">
        <textarea
          className={textareaClass}
          rows={3}
          value={borrador.service_place ?? ''}
          onChange={e => onChange({ service_place: e.target.value })}
          placeholder={'Nombre del local o proyecto\nDirección / sucursal'}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha del servicio" hint="Una fecha, un período o «A definir».">
          <input
            className={inputClass}
            value={borrador.service_date_text ?? ''}
            onChange={e => onChange({ service_date_text: e.target.value })}
            placeholder="A definir"
          />
        </Field>
        <Field label="Condiciones de crédito o pago">
          <textarea
            className={textareaClass}
            rows={2}
            value={borrador.credit_terms ?? ''}
            onChange={e => onChange({ credit_terms: e.target.value })}
            placeholder="50% adelanto - 50% contra entrega"
          />
        </Field>
      </div>

      <Field label="Preparado por">
        <input
          className={inputClass}
          value={borrador.prepared_by ?? ''}
          onChange={e => onChange({ prepared_by: e.target.value })}
          placeholder="Quién prepara el documento"
        />
      </Field>
      {borrador.quote_ref && (
        <p className="text-xs text-ink-faint">
          Cotización de origen: <span className="text-ink-soft">{borrador.quote_ref}</span>
        </p>
      )}
    </section>
  )
}
