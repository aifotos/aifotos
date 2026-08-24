import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import AppShell from './components/layout/AppShell.jsx'
import DragStrip from './components/layout/DragStrip.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Clients from './pages/Clients.jsx'
import Services from './pages/Services.jsx'
import Settings from './pages/Settings.jsx'
import InvoiceEditor from './pages/InvoiceEditor.jsx'
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
  // `null` = no hay editor abierto. Un id numerico abre esa factura;
  // 'nueva' abre un borrador en blanco.
  const [editando, setEditando] = useState(null)
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
        <DragStrip />
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
        <DragStrip />
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  const moneda = ajustes.currency_symbol

  const nuevaFactura = () => setEditando('nueva')
  const abrirFactura = (factura) => setEditando(factura.id)

  // El editor ocupa toda la ventana: no comparte sitio con la barra lateral,
  // porque al escribir una factura no quieres nada mas en pantalla.
  if (editando !== null) {
    return (
      <>
        <DragStrip />
        <InvoiceEditor
          // Al cambiar de factura hay que reiniciar el estado del formulario.
          // Sin esta `key`, React reutilizaria el componente y arrastraria el
          // borrador anterior a la factura recien abierta.
          key={editando}
          ajustes={ajustes}
          facturaId={editando === 'nueva' ? null : editando}
          onSalir={() => {
            setEditando(null)
            // Los ajustes pueden haber cambiado (numeracion consumida).
            settings.get().then(setAjustes).catch(() => {})
          }}
        />
      </>
    )
  }

  return (
    <AppShell seccion={seccion} onNavegar={setSeccion} onNuevaFactura={nuevaFactura}>
      <DragStrip />
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
