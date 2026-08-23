import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Field, { inputClass, textareaClass } from '../components/ui/Field.jsx'
import * as settings from '../db/settings.js'

/**
 * Tus datos como emisor. Es lo que sale en la cabecera de cada factura,
 * asi que conviene llenarlo antes de emitir la primera.
 */
export default function Settings({ onGuardado }) {
  const [datos, setDatos] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    settings.get().then(setDatos)
  }, [])

  const set = (campo) => (e) => {
    setDatos((d) => ({ ...d, [campo]: e.target.value }))
    setGuardado(false)
  }

  async function guardar() {
    setGuardando(true)
    try {
      const actualizado = await settings.update(datos)
      setDatos(actualizado)
      setGuardado(true)
      onGuardado?.(actualizado)
    } finally {
      setGuardando(false)
    }
  }

  if (!datos) {
    return (
      <>
        <PageHeader title="Ajustes" />
        <div className="flex items-center justify-center gap-2 py-20 text-ink-soft text-sm">
          <Loader2 className="size-4 animate-spin" /> Cargando…
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Tus datos aparecen en la cabecera de cada factura"
        actions={
          <Button variant="primary" onClick={guardar} disabled={guardando}
            icon={guardado ? Check : undefined}>
            {guardando ? 'Guardando…' : guardado ? 'Guardado' : 'Guardar cambios'}
          </Button>
        }
      />

      <div className="px-8 py-6 max-w-2xl space-y-6">
        <section className="bg-surface border border-line rounded-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Tu negocio</h2>
          <Field label="Nombre o razón social">
            <input className={inputClass} value={datos.business_name} onChange={set('business_name')}
              placeholder="AIFotos" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="RNC o cédula">
              <input className={inputClass} value={datos.tax_id} onChange={set('tax_id')}
                placeholder="131-12345-6" />
            </Field>
            <Field label="Teléfono">
              <input className={inputClass} value={datos.phone} onChange={set('phone')}
                placeholder="(809) 555-0134" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Correo">
              <input className={inputClass} value={datos.email} onChange={set('email')}
                placeholder="hola@ejemplo.com" />
            </Field>
            <Field label="Sitio web">
              <input className={inputClass} value={datos.website} onChange={set('website')}
                placeholder="ejemplo.com" />
            </Field>
          </div>
          <Field label="Dirección">
            <input className={inputClass} value={datos.address} onChange={set('address')}
              placeholder="Santo Domingo, República Dominicana" />
          </Field>
        </section>

        <section className="bg-surface border border-line rounded-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Facturación</h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Moneda">
              <input className={inputClass} value={datos.currency_symbol}
                onChange={set('currency_symbol')} placeholder="RD$" />
            </Field>
            <Field label="Prefijo" hint={`Próxima: ${settings.formatNumber(datos.invoice_prefix, datos.next_invoice_number)}`}>
              <input className={inputClass} value={datos.invoice_prefix}
                onChange={set('invoice_prefix')} placeholder="FAC-" />
            </Field>
            <Field label="Vence a los" hint="días desde la emisión">
              <input type="number" min="0" className={inputClass}
                value={datos.payment_terms_days}
                onChange={(e) => setDatos((d) => ({ ...d, payment_terms_days: Number(e.target.value) }))} />
            </Field>
          </div>
        </section>

        <section className="bg-surface border border-line rounded-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Textos por defecto</h2>
          <Field label="Nota al pie" hint="Se copia en cada factura nueva">
            <textarea className={textareaClass} value={datos.default_notes}
              onChange={set('default_notes')} placeholder="Gracias por confiar en nosotros." />
          </Field>
          <Field label="Datos de pago" hint="Cuenta bancaria, transferencia, etc.">
            <textarea className={textareaClass} value={datos.payment_details}
              onChange={set('payment_details')}
              placeholder="Banco Popular · Cuenta 123-456789-0" />
          </Field>
        </section>
      </div>
    </>
  )
}
