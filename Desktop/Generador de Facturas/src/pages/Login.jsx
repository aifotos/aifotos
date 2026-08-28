import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, KeyRound, Loader2, Lock } from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import { inputClass } from '../components/ui/Field.jsx'
import DragStrip from '../components/layout/DragStrip.jsx'
import * as auth from '../db/auth.js'
import { registrarFallo } from '../lib/logging.js'

/**
 * Pantalla de acceso.
 *
 * Es lo unico que se ve antes de elegir cuenta, y no es decorativo: hasta
 * que no hay sesion, las vistas de la base no devuelven ni una fila, asi
 * que literalmente no hay nada que enseñar.
 *
 * La primera vez cada cuenta pide crear su contraseña. No viene ninguna de
 * fabrica a proposito: el codigo de este proyecto esta publicado en
 * GitHub, y una contraseña escrita en el fuente seria una contraseña
 * publica el mismo dia.
 */
export default function Login({ onEntrar }) {
  const [cuentas, setCuentas] = useState(null)
  const [elegida, setElegida] = useState(null)
  const [clave, setClave] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState(null)
  const [entrando, setEntrando] = useState(false)
  const campo = useRef(null)

  useEffect(() => {
    auth.listarCuentas()
      .then(setCuentas)
      .catch((e) => {
        registrarFallo('acceso: no se pudieron leer las cuentas', e)
        setError(String(e?.message ?? e))
        setCuentas([])
      })
  }, [])

  useEffect(() => {
    if (elegida) campo.current?.focus()
  }, [elegida])

  const primeraVez = elegida && !elegida.tiene_contrasena

  function volver() {
    setElegida(null)
    setClave('')
    setConfirmacion('')
    setError(null)
  }

  async function entrar(e) {
    e?.preventDefault()
    if (entrando) return
    setError(null)

    if (primeraVez && clave !== confirmacion) {
      setError('Las dos contraseñas no coinciden')
      return
    }

    setEntrando(true)
    try {
      const cuenta = primeraVez
        ? await auth.crearContrasena(elegida.username, clave)
        : await auth.iniciarSesion(elegida.username, clave)
      onEntrar(cuenta)
    } catch (err) {
      setError(String(err?.message ?? err))
      setClave('')
      setConfirmacion('')
      campo.current?.focus()
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-8">
      <DragStrip />

      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="size-11 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-3">
            <Lock className="size-5 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-lg font-semibold text-ink">FacturaPro</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {elegida ? `Entrando como ${elegida.display_name}` : 'Elige con qué negocio vas a trabajar'}
          </p>
        </div>

        {!cuentas ? (
          <div className="flex justify-center py-6 text-ink-soft">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : !elegida ? (
          <div className="space-y-2">
            {cuentas.map((c) => (
              <button
                key={c.id}
                onClick={() => setElegida(c)}
                className="w-full h-14 px-4 rounded-2xl bg-surface border border-line
                  flex items-center justify-between gap-3 text-left
                  hover:border-brand-400 hover:shadow-card transition-all"
              >
                <span>
                  <span className="block text-sm font-semibold text-ink">{c.display_name}</span>
                  <span className="block text-xs text-ink-faint">
                    {c.tiene_contrasena ? c.username : 'Sin contraseña — se crea al entrar'}
                  </span>
                </span>
                <KeyRound className="size-4 text-ink-faint shrink-0" strokeWidth={2} />
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={entrar} className="space-y-3">
            {primeraVez && (
              <p className="rounded-xl bg-pending-bg text-pending-ink text-xs
                leading-relaxed px-3 py-2.5">
                Esta cuenta todavía no tiene contraseña. La que escribas ahora será la suya
                a partir de hoy — solo se guarda cifrada, en este Mac.
              </p>
            )}

            <input
              ref={campo}
              type="password"
              className={inputClass}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder={primeraVez ? 'Nueva contraseña' : 'Contraseña'}
              autoComplete={primeraVez ? 'new-password' : 'current-password'}
            />

            {primeraVez && (
              <input
                type="password"
                className={inputClass}
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder="Repítela"
                autoComplete="new-password"
              />
            )}

            {error && (
              <p className="flex items-start gap-1.5 text-xs text-overdue-ink">
                <AlertTriangle className="size-3.5 shrink-0 mt-px" strokeWidth={2} />
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={entrando || !clave}
            >
              {entrando ? 'Comprobando…' : primeraVez ? 'Crear y entrar' : 'Entrar'}
            </Button>

            <button
              type="button"
              onClick={volver}
              className="w-full h-8 text-xs text-ink-soft hover:text-ink
                inline-flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="size-3.5" strokeWidth={2} /> Cambiar de cuenta
            </button>
          </form>
        )}

        {!elegida && error && (
          <p className="mt-4 text-center text-xs text-overdue-ink" data-selectable>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
