import { useCallback, useEffect, useState } from 'react'
import { Pencil, User } from 'lucide-react'
import Picker from '../ui/Picker.jsx'
import ClientDialog from './ClientDialog.jsx'
import * as clients from '../../db/clients.js'

/**
 * Datos del cliente de la factura.
 *
 * Se elige de la lista de clientes guardados o se crea uno nuevo, y crear
 * es un gesto explicito que abre un formulario y graba el cliente en el
 * acto. Antes era un campo libre que se "aprendia" al emitir: comodo, pero
 * dejaba sin saber si el cliente habia quedado guardado o no.
 *
 * La factura conserva su copia congelada de los datos (`client.*`), asi que
 * si el cliente cambia de direccion el ano que viene, esta factura sigue
 * imprimiendo la que tenia al emitirse.
 */
export default function ClientSection({ client, onChange }) {
  const [dialogo, setDialogo] = useState(null) // null | { cliente, nombreInicial }
  const [elegido, setElegido] = useState(null)
  const [recargar, setRecargar] = useState(0)

  const buscar = useCallback((t) => clients.search(t, 20), [])

  // Al abrir una factura ya guardada hay que recuperar el registro del
  // cliente a partir del nombre congelado, para poder editarlo.
  useEffect(() => {
    const nombre = client.name?.trim()
    if (!nombre) {
      setElegido(null)
      return
    }
    let vivo = true
    clients.getByName(nombre).then((c) => vivo && setElegido(c))
    return () => {
      vivo = false
    }
  }, [client.name])

  function aplicar(c) {
    setElegido(c)
    onChange({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      tax_id: c.tax_id ?? '',
    })
  }

  const detalles = [client.tax_id && `RNC ${client.tax_id}`, client.address, client.phone, client.email]
    .filter(Boolean)

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-wide">
        Facturar a
      </h2>

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <Picker
            valor={client.name ? { name: client.name } : null}
            buscar={buscar}
            recargar={recargar}
            onElegir={aplicar}
            onCrear={(texto) => setDialogo({ cliente: null, nombreInicial: texto })}
            placeholder="Elige un cliente o crea uno nuevo"
            etiquetaCrear="Crear cliente nuevo"
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
          </Picker>
        </div>

        {client.name?.trim() && (
          <button
            type="button"
            onClick={() => setDialogo({ cliente: elegido, nombreInicial: client.name })}
            className="h-10 px-3 rounded-xl border border-line bg-surface text-ink-soft
              hover:text-ink hover:bg-canvas transition-colors inline-flex items-center gap-1.5
              text-sm shrink-0"
          >
            <Pencil className="size-3.5" strokeWidth={2} /> Editar
          </button>
        )}
      </div>

      {client.name?.trim() && (
        <div className="rounded-xl border border-line bg-canvas/60 px-3 py-2.5">
          {detalles.length > 0 ? (
            <p className="text-xs text-ink-soft leading-relaxed">{detalles.join(' · ')}</p>
          ) : (
            <p className="text-xs text-ink-faint inline-flex items-center gap-1.5">
              <User className="size-3 shrink-0" />
              Sin datos de contacto. Pulsa «Editar» para añadir correo, teléfono o RNC.
            </p>
          )}
        </div>
      )}

      <ClientDialog
        abierto={!!dialogo}
        cliente={dialogo?.cliente ?? null}
        nombreInicial={dialogo?.nombreInicial ?? ''}
        onCerrar={() => setDialogo(null)}
        onGuardado={(c) => {
          aplicar(c)
          // Fuerza a la lista a releer: si no, el cliente recien creado no
          // aparece hasta reabrir el editor.
          setRecargar((n) => n + 1)
        }}
      />
    </section>
  )
}
