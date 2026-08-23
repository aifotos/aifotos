import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import AppShell from './components/layout/AppShell.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Clients from './pages/Clients.jsx'
import Services from './pages/Services.jsx'
import Settings from './pages/Settings.jsx'
import * as settings from './db/settings.js'
import { registrarFallo } from './lib/logging.js'

/**
 * Raiz de la app.
 *
 * La navegacion es un `useState`, no una libreria de rutas: son cuatro
 * pantallas en una app de escritorio sin URLs, sin historial de navegador
 * y sin enlaces compartibles. Un router aqui seria peso muerto.
 */
export default function App() {
  const [seccion, setSeccion] = useState('invoices')
  const [ajustes, setAjustes] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    settings.get()
      .then(setAjustes)
      .catch((e) => {
        registrarFallo('arranque: no se pudo abrir la base de datos', e)
        setError(String(e?.message ?? e))
      })
  }, [])

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-10">
        <div className="max-w-md text-center">
          <div className="size-12 rounded-2xl bg-overdue-bg flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="size-6 text-overdue-ink" strokeWidth={2} />
          </div>
          <h1 className="text-base font-semibold text-ink">No se pudo abrir la base de datos</h1>
          <p className="mt-2 text-sm text-ink-soft" data-selectable>{error}</p>
        </div>
      </div>
    )
  }

  if (!ajustes) {
    return (
      <div className="h-full flex items-center justify-center text-ink-soft">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  const moneda = ajustes.currency_symbol

  // El editor de facturas llega en la Fase 4.
  const nuevaFactura = () => {}
  const abrirFactura = () => {}

  return (
    <AppShell seccion={seccion} onNavegar={setSeccion} onNuevaFactura={nuevaFactura}>
      {seccion === 'invoices' && (
        <Dashboard
          moneda={moneda}
          onNuevaFactura={nuevaFactura}
          onAbrirFactura={abrirFactura}
        />
      )}
      {seccion === 'clients' && <Clients />}
      {seccion === 'services' && <Services moneda={moneda} />}
      {seccion === 'settings' && <Settings onGuardado={setAjustes} />}
    </AppShell>
  )
}
