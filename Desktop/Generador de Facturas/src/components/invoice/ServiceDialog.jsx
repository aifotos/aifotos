import { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import { formatAmount, toCents } from '../../lib/money.js'
import * as services from '../../db/services.js'

const VACIO = { name: '', description: '', unit: 'unidad', precio: '' }

const UNIDADES = ['unidad', 'hora', 'día', 'sesión', 'proyecto', 'mes', 'imagen', 'video', 'evento']

/**
 * Alta y edicion de un servicio del catalogo, guardado en el acto.
 */
export default function ServiceDialog({ abierto, servicio, nombreInicial = '', moneda = 'RD$', onCerrar, onGuardado }) {
  const [datos, setDatos] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!abierto) return
    setDatos(
      servicio
        ? { ...VACIO, ...servicio, precio: formatAmount(servicio.unit_price_cents) }
        : { ...VACIO, name: nombreInicial },
    )
    setError(null)
  }, [abierto, servicio, nombreInicial])

  const set = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }))

  async function guardar() {
    const nombre = datos.name.trim()
    if (!nombre) {
      setError('El nombre es obligatorio')
      return
    }
    setGuardando(true)
    try {
      const payload = {
        name: nombre,
        description: datos.description,
        unit: datos.unit,
        unit_price_cents: toCents(datos.precio),
      }
      const existente = await services.getByName?.(nombre)
      const id = servicio?.id ?? existente?.id
      const guardado = id
        ? await services.update(id, payload)
        : await services.upsertByName(payload)
      onGuardado(guardado)
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
      title={servicio ? 'Editar servicio' : 'Nuevo servicio'}
      ancho="max-w-md"
      acciones={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar servicio'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-left">
        <Field label="Nombre">
          <input
            className={inputClass}
            value={datos.name}
            onChange={set('name')}
            placeholder="Creación de contenido mensual"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && guardar()}
          />
        </Field>
        <Field label="Descripción" hint="Opcional, solo para reconocerlo en el catálogo">
          <input className={inputClass} value={datos.description} onChange={set('description')}
            placeholder="12 piezas al mes, guion incluido" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Precio (${moneda})`}>
            <input className={`${inputClass} tabular-nums`} value={datos.precio}
              onChange={set('precio')} inputMode="decimal" placeholder="0.00"
              onKeyDown={(e) => e.key === 'Enter' && guardar()} />
          </Field>
          <Field label="Se cobra por">
            <select className={inputClass} value={datos.unit} onChange={set('unit')}>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </Field>
        </div>

        {error && <p className="text-xs text-overdue-ink">{error}</p>}

      </div>
    </Modal>
  )
}
