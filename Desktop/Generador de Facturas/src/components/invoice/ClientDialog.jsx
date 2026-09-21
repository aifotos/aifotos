import { useEffect, useRef, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import * as clients from '../../db/clients.js'

const VACIO = { name: '', email: '', phone: '', address: '', tax_id: '' }

/**
 * Alta y edicion de un cliente, guardado en el acto.
 *
 * El cliente se graba al pulsar Guardar, no cuando se emite la factura:
 * asi sabes que quedo guardado en el momento, en lugar de confiar en que
 * el sistema lo aprenda mas tarde.
 */
export default function ClientDialog({ abierto, cliente, nombreInicial = '', onCerrar, onGuardado }) {
  const ocupado = useRef(false)
  const [datos, setDatos] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!abierto) return
    setDatos(cliente ? { ...VACIO, ...cliente } : { ...VACIO, name: nombreInicial })
    setError(null)
  }, [abierto, cliente, nombreInicial])

  const set = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }))

  async function guardar() {
    if (ocupado.current) return
    const nombre = datos.name.trim()
    if (!nombre) {
      setError('El nombre es obligatorio')
      return
    }
    ocupado.current = true
    setGuardando(true)
    try {
      // Si ya existe otro cliente con ese nombre, se edita ese en lugar de
      // crear un duplicado: `name_key` es UNIQUE y el INSERT fallaria.
      const existente = await clients.getByName(nombre)
      if (existente && existente.id !== cliente?.id) throw new Error('Ya existe otro cliente con ese nombre. Selecciónalo desde la lista.')
      const id = cliente?.id
      const guardado = id
        ? await clients.update(id, datos)
        : await clients.upsertByName(datos)
      onGuardado(guardado)
      onCerrar()
    } catch (e) {
      setError(String(e?.message ?? e))
    } finally {
      ocupado.current = false
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => !ocupado.current && onCerrar()}
      title={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      ancho="max-w-md"
      acciones={
        <>
          <Button disabled={guardando} onClick={onCerrar}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cliente'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-left">
        <Field label="Nombre o razón social">
          <input
            className={inputClass}
            value={datos.name}
            onChange={set('name')}
            placeholder="Nashla Bogaert"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && guardar()}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Correo">
            <input className={inputClass} value={datos.email} onChange={set('email')}
              placeholder="cliente@correo.com" />
          </Field>
          <Field label="Teléfono">
            <input className={inputClass} value={datos.phone} onChange={set('phone')}
              placeholder="(809) 555-0000" />
          </Field>
        </div>
        <Field label="Dirección">
          <input className={inputClass} value={datos.address} onChange={set('address')}
            placeholder="Santo Domingo" />
        </Field>
        <Field label="RNC o cédula">
          <input className={inputClass} value={datos.tax_id} onChange={set('tax_id')}
            placeholder="131-12345-6" />
        </Field>

        {cliente && <p className="text-xs text-ink-soft">Se actualiza la ficha del cliente y, si estás editando un documento, sus datos en ese documento.</p>}
        {error && <p className="text-xs text-overdue-ink">{error}</p>}

      </div>
    </Modal>
  )
}
