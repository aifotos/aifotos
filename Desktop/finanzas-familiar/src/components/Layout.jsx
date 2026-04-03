import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Landmark,
  PiggyBank,
  HeartPulse,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transacciones', label: 'Transacciones', icon: ArrowLeftRight },
  { id: 'tarjetas', label: 'Cuentas', icon: Wallet },
  { id: 'prestamos', label: 'Préstamos', icon: Landmark },
  { id: 'presupuesto', label: 'Presupuesto', icon: PiggyBank },
  { id: 'salud', label: 'Salud Financiera', icon: HeartPulse },
]

export default function Layout({ currentView, onNavigate, children }) {
  const { perfil, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleNav = (id) => {
    onNavigate(id)
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      {/* Overlay móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800
          flex flex-col transition-transform duration-200 ease-out
          lg:translate-x-0 lg:static lg:z-auto
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-800">
          <span className="text-lg font-bold tracking-tight text-emerald-400">
            💰 FinanzasRD
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = currentView === id
            return (
              <button
                key={id}
                onClick={() => handleNav(id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }
                `}
              >
                <Icon size={18} />
                {label}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 truncate max-w-[140px]">
              {perfil?.nombre}
            </span>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-red-400 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar móvil */}
        <header className="h-16 flex items-center px-4 border-b border-gray-800 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <Menu size={22} />
          </button>
          <span className="ml-3 text-sm font-bold text-emerald-400">
            FinanzasRD
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}