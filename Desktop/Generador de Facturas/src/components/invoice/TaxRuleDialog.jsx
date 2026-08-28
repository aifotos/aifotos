import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import { formatAmount, toCents } from '../../lib/money.js'
import * as taxes from '../../db/taxes.js'

const VACIO = { name: '', kind: 'tax', base: 'subtotal', valor: '' }

/**
 * Alta y edicion de una regla de impuesto o retencion.
 *
 * Se guarda en el catalogo de la cuenta en el acto, igual que un cliente o
 * un servicio: la creas una vez y luego la aplicas con dos clics a los
 * documentos que la necesiten.
 */
export default function TaxRuleDialog({ abierto, regla, nombreInicial = '', moneda = 'RD$', onCerrar, onGuardado }) {
  const [datos, setDatos] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!abierto) return
    setDatos(
      regla
        ? {
            name: regla.name,
            kind: regla.kind,
            base: regla.base,
            valor:
              regla.base === 'fixed'
                ? formatAmount(regla.rate_bp)
                : String(regla.rate_bp / 100),
          }
        : { ...VACIO, name: nombreInicial },
    )
    setError(null)
  }, [abierto, regla, nombreInicial])

  const set = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }))
  const esFijo = datos.base === 'fixed'

  async function guardar() {
    const nombre = datos.name.trim()
    if (!nombre) {
      setError('Ponle un nombre: es el que sale impreso en la factura')
      return
    }
    setGuardando(true)
    try {
      // El mismo campo guarda dos cosas distintas segun la base, igual que
      // el descuento del documento: centavos si es un importe fijo, y
      // centesimas de punto si es un porcentaje (18 % -> 1800).
      const rate_bp = esFijo
        ? toCents(datos.valor)
        : Math.max(0, Math.round(parseFloat(String(datos.valor).replace(',', '.') || '0') * 100))

      const payload = { name: nombre, kind: datos.kind, base: datos.base, rate_bp }
      const guardada = regla
        ? await taxes.actualizar(regla.id, payload)
        : await taxes.crear(payload)
      onGuardado(guardada)
      onCerrar()
    } catch (e) {
      setError(String(e?.message ?? e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      title={regla ? 'Editar regla' : 'Nuevo impuesto o retención'}
      ancho="max-w-md"
      acciones={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-left">
        <Field label="Nombre" hint="Tal como quieres que salga impreso">
          <input
            className={inputClass}
            value={datos.name}
            onChange={set('name')}
            placeholder="ITBIS 18%"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && guardar()}
          />
        </Field>

        <Field label="Tipo">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(taxes.TIPOS).map(([id, t]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDatos((d) => ({ ...d, kind: id }))}
                className={`h-auto py-2 px-3 rounded-xl border text-left transition-colors
                  ${datos.kind === id
                    ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100'
                    : 'border-line bg-surface hover:bg-canvas'}`}
              >
                <span className="block text-sm font-medium text-ink">
                  {t.signo} {t.label}
                </span>
                <span className="block text-xs text-ink-faint leading-snug">{t.ayuda}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Se calcula">
          <select className={inputClass} value={datos.base} onChange={set('base')}>
            {Object.entries(taxes.BASES).map(([id, b]) => (
              <option key={id} value={id}>
                {b.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="-mt-1 text-xs text-ink-faint">{taxes.BASES[datos.base].ayuda}</p>

        <Field label={esFijo ? `Importe (${moneda})` : 'Porcentaje'}>
          <div className="relative">
            <input
              className={`${inputClass} tabular-nums ${esFijo ? '' : 'pr-8'}`}
              value={datos.valor}
              onChange={set('valor')}
              inputMode="decimal"
              placeholder={esFijo ? '0.00' : '18'}
              onKeyDown={(e) => e.key === 'Enter' && guardar()}
            />
            {!esFijo && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
                %
              </span>
            )}
          </div>
        </Field>

        {error && <p className="text-xs text-overdue-ink">{error}</p>}
      </div>
    </Modal>
  )
}
