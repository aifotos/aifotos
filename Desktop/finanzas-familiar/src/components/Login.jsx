import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistro, setIsRegistro] = useState(false)
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setMensaje(null)
    setCargando(true)

    if (isRegistro) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMensaje('Revisa tu correo para confirmar tu cuenta.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }

    setCargando(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">💰 Finanzas Familiar</h1>
          <p className="text-gray-400 mt-2">
            {isRegistro ? 'Crea tu cuenta' : 'Inicia sesión'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 p-2 rounded">{error}</p>
          )}
          {mensaje && (
            <p className="text-green-400 text-sm bg-green-400/10 p-2 rounded">{mensaje}</p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {cargando ? 'Cargando...' : isRegistro ? 'Registrarse' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          {isRegistro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            onClick={() => {
              setIsRegistro(!isRegistro)
              setError(null)
              setMensaje(null)
            }}
            className="text-blue-400 hover:underline"
          >
            {isRegistro ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </p>
      </div>
    </div>
  )
}