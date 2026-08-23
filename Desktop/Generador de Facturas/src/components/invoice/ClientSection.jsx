import { useCallback, useEffect, useState } from 'react'
import { User } from 'lucide-react'
import Autocomplete from '../ui/Autocomplete.jsx'
import { inputClass } from '../ui/Field.jsx'
import useDebounced from '../../hooks/useDebounced.js'
import * as clients from '../../db/clients.js'

/**
 * Datos del cliente.
 *
 * El nombre es un campo libre con sugerencias, no un desplegable: escribes
 * un cliente nuevo y se guarda solo al guardar la factura. Si eliges uno
 * existente, se rellenan los demas campos de golpe.
 */
export default function ClientSection({ client, onChange }) {
  const buscar = useCallback((t) => clients.search(t, 6), [])
  const [esNuevo, setEsNuevo] = useState(false)

  // El aviso solo aparece si el cliente de verdad no existe todavia. Salia
  // tambien al elegir uno de la lista, que es justo cuando no hace falta.
  const nombre = useDebounced(client.name ?? '', 400)
  useEffect(() => {
    const limpio = nombre.trim()
    if (!limpio) {
      setEsNuevo(false)
      return
    }
    let vivo = true
    clients.getByName(limpio).then((c) => vivo && setEsNuevo(!c))
    return () => {
      vivo = false
    }
  }, [nombre])

  const set = (campo) => (e) => onChange({ ...client, [campo]: e.target.value })

  function elegirCliente(c) {
    onChange({
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      tax_id: c.tax_id,
    })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-wide">
        Facturar a
      </h2>

      <Autocomplete
        value={client.name}
        onChange={(v) => onChange({ ...client, name: v })}
        onElegir={elegirCliente}
        buscar={buscar}
        placeholder="Nombre del cliente"
        className={`${inputClass} font-medium`}
      >
        {(c) => (
          <>
            <p className="text-sm text-ink truncate">{c.name}</p>
            {(c.email || c.phone) && (
              <p className="text-xs text-ink-faint truncate">
                {[c.email, c.phone].filter(Boolean).join(' · ')}
              </p>
            )}
          </>
        )}
      </Autocomplete>

      <div className="grid grid-cols-2 gap-3">
        <input className={inputClass} value={client.email} onChange={set('email')}
          placeholder="Correo" />
        <input className={inputClass} value={client.phone} onChange={set('phone')}
          placeholder="Teléfono" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className={inputClass} value={client.address} onChange={set('address')}
          placeholder="Dirección" />
        <input className={inputClass} value={client.tax_id} onChange={set('tax_id')}
          placeholder="RNC o cédula" />
      </div>

      {esNuevo && (
        <p className="flex items-center gap-1.5 text-xs text-ink-faint">
          <User className="size-3 shrink-0" />
          Cliente nuevo: se guardará en tu lista al emitir la factura
        </p>
      )}
    </section>
  )
}
