import { useState } from 'react'
import { Check } from 'lucide-react'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import * as auth from '../../db/auth.js'

/**
 * Cambio de contrasena de la cuenta abierta.
 *
 * Pide la actual antes de aceptar la nueva. No es paranoia en una app
 * local: sin ese paso, cualquiera que pase por delante del Mac con la
 * sesion abierta puede cambiarla y dejarte fuera de tu propia
 * contabilidad.
 */
export default function PasswordCard({ cuenta }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [estado, setEstado] = useState(null) // null | 'guardando' | 'hecho'
  const [error, setError] = useState(null)

  async function cambiar(e) {
    e.preventDefault()
    setError(null)
    if (nueva !== repetida) {
      setError('Las dos contraseñas nuevas no coinciden')
      return
    }
    setEstado('guardando')
    try {
      await auth.cambiarContrasena(cuenta.username, actual, nueva)
      setActual('')
      setNueva('')
      setRepetida('')
      setEstado('hecho')
    } catch (err) {
      setError(String(err?.message ?? err))
      setEstado(null)
    }
  }

  return (
    <form onSubmit={cambiar} className="bg-surface border border-line rounded-card p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">Contraseña</h2>
        <p className="mt-0.5 text-xs text-ink-faint">
          La de la cuenta <span className="text-ink-soft">{cuenta.username}</span>.
        </p>
      </div>

      <Field label="Contraseña actual">
        <input type="password" className={inputClass} value={actual} autoComplete="current-password"
          onChange={(e) => { setActual(e.target.value); setEstado(null) }} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nueva">
          <input type="password" className={inputClass} value={nueva} autoComplete="new-password"
            onChange={(e) => { setNueva(e.target.value); setEstado(null) }} />
        </Field>
        <Field label="Repítela">
          <input type="password" className={inputClass} value={repetida} autoComplete="new-password"
            onChange={(e) => { setRepetida(e.target.value); setEstado(null) }} />
        </Field>
      </div>

      {error && <p className="text-xs text-overdue-ink">{error}</p>}

      <Button
        type="submit"
        variant={estado === 'hecho' ? 'secondary' : 'primary'}
        icon={estado === 'hecho' ? Check : undefined}
        disabled={estado === 'guardando' || !nueva}
      >
        {estado === 'guardando' ? 'Cambiando…' : estado === 'hecho' ? 'Contraseña cambiada' : 'Cambiar contraseña'}
      </Button>
    </form>
  )
}
