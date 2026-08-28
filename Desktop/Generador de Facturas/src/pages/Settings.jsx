import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Field, { inputClass, textareaClass } from '../components/ui/Field.jsx'
import LogoUploader from '../components/settings/LogoUploader.jsx'
import TaxRulesCard from '../components/settings/TaxRulesCard.jsx'
import PasswordCard from '../components/settings/PasswordCard.jsx'
import * as settings from '../db/settings.js'

/** Colores de acento sugeridos para las bandas del documento. */
const ACENTOS = ['#F5C851', '#3B74F5', '#101318', '#12805C', '#C2410C', '#7C3AED']

/**
 * Ajustes del negocio con el que has entrado.
 *
 * Cada cuenta tiene los suyos: su logo, su color, su numeracion y sus
 * datos de pago. Cambiar aqui algo con la sesion de remont abierta no
 * toca nada de aifotos, porque `settings.get()` lee por una vista que
 * filtra por la sesion.
 */
export default function Settings({ cuenta, onGuardado }) {
  const [datos, setDatos] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    settings.get().then(setDatos)
  }, [])

  const set = (campo) => (e) => cambiar(campo, e.target.value)
  const cambiar = (campo, valor) => {
    setDatos((d) => ({ ...d, [campo]: valor }))
    setGuardado(false)
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const actualizado = await settings.update(datos)
      setDatos(actualizado)
      setGuardado(true)
      onGuardado?.(actualizado)
    } catch (e) {
      setError(String(e?.message ?? e))
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

  const proximo = settings.formatNumber(
    datos.invoice_prefix,
    datos.next_invoice_number,
    datos.number_padding,
  )

  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle={`Lo que sale en las facturas de ${datos.business_name || cuenta.display_name}`}
        actions={
          <Button variant="primary" onClick={guardar} disabled={guardando}
            icon={guardado ? Check : undefined}>
            {guardando ? 'Guardando…' : guardado ? 'Guardado' : 'Guardar cambios'}
          </Button>
        }
      />

      <div className="px-8 py-6 max-w-2xl space-y-6">
        {error && (
          <p className="rounded-xl bg-overdue-bg text-overdue-ink text-sm px-4 py-3">{error}</p>
        )}

        <section className="bg-surface border border-line rounded-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Tu negocio</h2>

          <LogoUploader
            valor={datos.logo_data_url}
            onChange={(v) => cambiar('logo_data_url', v)}
          />

          <Field label="Nombre o razón social">
            <input className={inputClass} value={datos.business_name} onChange={set('business_name')}
              placeholder={cuenta.display_name} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="RNC o cédula">
              <input className={inputClass} value={datos.tax_id} onChange={set('tax_id')}
                placeholder="131-12345-6" />
            </Field>
            <Field label="Teléfono">
              <input className={inputClass} value={datos.phone} onChange={set('phone')}
                placeholder="809-000-0000" />
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
              placeholder="Calle y número, sector, ciudad" />
          </Field>

          <Field label="Color del documento" hint="Las bandas de la cabecera y del total">
            <div className="flex items-center gap-2">
              {ACENTOS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => cambiar('accent_color', c)}
                  aria-label={`Usar el color ${c}`}
                  style={{ background: c }}
                  className={`size-8 rounded-lg border transition-all
                    ${datos.accent_color?.toUpperCase() === c.toUpperCase()
                      ? 'border-ink ring-2 ring-brand-100 scale-110'
                      : 'border-line'}`}
                />
              ))}
              <input
                type="color"
                value={datos.accent_color || '#F5C851'}
                onChange={set('accent_color')}
                aria-label="Otro color"
                className="size-8 rounded-lg border border-line bg-surface cursor-pointer"
              />
            </div>
          </Field>
        </section>

        <section className="bg-surface border border-line rounded-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Numeración</h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Moneda">
              <input className={inputClass} value={datos.currency_symbol}
                onChange={set('currency_symbol')} placeholder="RD$" />
            </Field>
            <Field label="Prefijo" hint="Vacío para numerar sin letras">
              <input className={inputClass} value={datos.invoice_prefix}
                onChange={set('invoice_prefix')} placeholder="FAC-" />
            </Field>
            <Field label="Dígitos" hint="4 → 0007 · 5 → 00024">
              <input type="number" min="1" max="9" className={inputClass}
                value={datos.number_padding}
                onChange={(e) => cambiar('number_padding', Number(e.target.value))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Próximo número" hint={`Se emitirá como ${proximo}`}>
              <input type="number" min="1" className={`${inputClass} tabular-nums`}
                value={datos.next_invoice_number}
                onChange={(e) => cambiar('next_invoice_number', Number(e.target.value))} />
            </Field>
            <Field label="Vence a los" hint="días desde la emisión">
              <input type="number" min="0" className={inputClass}
                value={datos.payment_terms_days}
                onChange={(e) => cambiar('payment_terms_days', Number(e.target.value))} />
            </Field>
          </div>
          <p className="text-xs text-ink-faint leading-relaxed">
            Bajar el próximo número por debajo de uno ya emitido hará que el guardado falle
            cuando llegue a repetirse: dentro de una cuenta, dos facturas no pueden llevar
            el mismo.
          </p>
        </section>

        <TaxRulesCard moneda={datos.currency_symbol} />

        <section className="bg-surface border border-line rounded-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Textos por defecto</h2>
          <Field label="Términos y condiciones" hint="Se copia en cada documento nuevo">
            <textarea className={textareaClass} value={datos.default_notes}
              onChange={set('default_notes')}
              placeholder="Las cancelaciones deben notificarse con un mínimo de 24 horas de anticipación." />
          </Field>
          <Field label="Información de pago" hint="Banco, cuenta, a nombre de quién">
            <textarea className={textareaClass} value={datos.payment_details}
              onChange={set('payment_details')}
              placeholder={'Banco Popular Dominicano\nCuenta corriente: 000000000\nNombre Apellido Ced.: 000-0000000-0'} />
          </Field>
          <Field label="Usuario" hint="Quién prepara los documentos; sale al pie">
            <input className={inputClass} value={datos.default_user}
              onChange={set('default_user')} placeholder="Tu nombre" />
          </Field>
        </section>

        <PasswordCard cuenta={cuenta} />
      </div>
    </>
  )
}
