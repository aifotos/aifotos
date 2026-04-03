import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)

  // Categorías predeterminadas para nuevos usuarios
  async function seedCategorias(perfilId) {
    const defaults = [
      { nombre: 'Salario', icono: '💼', tipo: 'ingreso' },
      { nombre: 'Freelance', icono: '💻', tipo: 'ingreso' },
      { nombre: 'Negocio', icono: '🏢', tipo: 'ingreso' },
      { nombre: 'Inversiones', icono: '📈', tipo: 'ingreso' },
      { nombre: 'Otros ingresos', icono: '💰', tipo: 'ingreso' },
      { nombre: 'Supermercado', icono: '🛒', tipo: 'gasto' },
      { nombre: 'Alquiler/Vivienda', icono: '🏠', tipo: 'gasto' },
      { nombre: 'Servicios (Luz, Agua)', icono: '⚡', tipo: 'gasto' },
      { nombre: 'Transporte', icono: '🚗', tipo: 'gasto' },
      { nombre: 'Restaurantes', icono: '🍔', tipo: 'gasto' },
      { nombre: 'Salud', icono: '💊', tipo: 'gasto' },
      { nombre: 'Educación', icono: '📚', tipo: 'gasto' },
      { nombre: 'Ropa', icono: '👗', tipo: 'gasto' },
      { nombre: 'Entretenimiento', icono: '🎬', tipo: 'gasto' },
      { nombre: 'Pago tarjeta', icono: '💳', tipo: 'gasto' },
      { nombre: 'Pago préstamo', icono: '🏦', tipo: 'gasto' },
      { nombre: 'Tecnología', icono: '📱', tipo: 'gasto' },
      { nombre: 'Otros gastos', icono: '💸', tipo: 'gasto' },
    ]
    await supabase.from('categorias').insert(
      defaults.map((c) => ({ ...c, perfil_id: perfilId }))
    )
  }

  // Busca o crea el perfil del usuario
  async function fetchOrCreatePerfil(userId, email) {
    // Buscar perfil existente
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (data) {
      setPerfil(data)
      return
    }

    // Si no existe, crear uno con el nombre del email
    const nombre = email.split('@')[0]
    const { data: nuevo, error: errCrear } = await supabase
      .from('perfiles')
      .insert({ user_id: userId, nombre })
      .select()
      .single()

    if (nuevo) {
      setPerfil(nuevo)
      await seedCategorias(nuevo.id)
    }
    if (errCrear) console.error('Error creando perfil:', errCrear)
  }

  useEffect(() => {
    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchOrCreatePerfil(session.user.id, session.user.email)
      }
      setLoading(false)
    })

    // Escuchar cambios de sesión (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) {
          fetchOrCreatePerfil(session.user.id, session.user.email)
        } else {
          setPerfil(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
    setPerfil(null)
  }

  return (
    <AuthContext.Provider value={{ session, perfil, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}