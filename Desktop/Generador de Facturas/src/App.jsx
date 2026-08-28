import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import AppShell from './components/layout/AppShell.jsx'
import DragStrip from './components/layout/DragStrip.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Clients from './pages/Clients.jsx'
import Services from './pages/Services.jsx'
import Settings from './pages/Settings.jsx'
import InvoiceEditor from './pages/InvoiceEditor.jsx'
import * as settings from './db/settings.js'
import * as auth from './db/auth.js'
import { doc as vocabulario } from './lib/documentos.js'
import { registrarFallo } from './lib/logging.js'

/**
 * Raiz de la app.
 *
 * La navegacion es un `useState`, no una libreria de rutas: son cinco
 * pantallas en una app de escritorio sin URLs, sin historial de navegador
 * y sin enlaces compartibles. Un router aqui seria peso muerto.
 *
 * Lo primero que hace al arrancar es CERRAR cualquier sesion que hubiera
 * quedado abierta. Sin eso la app abriria en la ultima cuenta usada y el
 * acceso no serviria para nada: el sentido de tener dos negocios separados
 * es no emitir por error desde el equivocado, y para eso hay que elegir a
 * proposito cada vez.
 */
export default function App() {
  const [arrancando, setArrancando] = useState(true)
  const [cuenta, setCuenta] = useState(null)
  const [seccion, setSeccion] = useState('invoices')
  // `null` = no hay editor abierto. Si no, { id, kind }: un id numerico abre
  // ese documento y 'nuevo' abre un borrador en blanco del tipo indicado.
  const [editando, setEditando] = useState(null)
  const [ajustes, setAjustes] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    auth.limpiarSesion()
      .catch((e) => {
        registrarFallo('arranque: no se pudo abrir la base de datos', e)
        setError(String(e?.message ?? e))
      })
      .finally(() => setArrancando(false))
  }, [])

  /** Tras entrar, los ajustes que se cargan son los de ESA cuenta. */
  function entrar(nueva) {
    settings.get()
      .then((a) => {
        setAjustes(a)
        setCuenta(nueva)
      })
      .catch((e) => {
        registrarFallo('acceso: no se pudieron cargar los ajustes', e)
        setError(String(e?.message ?? e))
      })
  }

  async function salir() {
    await auth.cerrarSesion().catch(() => {})
    // Se limpia TODO lo que hubiera en pantalla, no solo la cuenta: un
    // documento abierto de aifotos no puede sobrevivir a un cambio a
    // remont, porque su siguiente autoguardado escribiria en la cuenta
    // equivocada.
    setEditando(null)
    setAjustes(null)
    setSeccion('invoices')
    setCuenta(null)
  }

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

  if (arrancando) {
    return (
      <div className="h-full flex items-center justify-center text-ink-soft">
        <DragStrip />
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  if (!cuenta || !ajustes) {
    return <Login onEntrar={entrar} />
  }

  const moneda = ajustes.currency_symbol

  // La seccion activa decide que se crea al pulsar "Nueva…".
  const kindActual = seccion === 'quotes' ? 'quote' : 'invoice'
  const v = vocabulario(kindActual)

  const nuevoDocumento = () => setEditando({ id: 'nuevo', kind: kindActual })
  const abrirDocumento = (doc) => setEditando({ id: doc.id, kind: doc.kind ?? 'invoice' })

  // El editor ocupa toda la ventana: no comparte sitio con la barra lateral,
  // porque al escribir una factura no quieres nada mas en pantalla.
  if (editando !== null) {
    return (
      <>
        <DragStrip />
        <InvoiceEditor
          // Al cambiar de documento hay que reiniciar el estado del
          // formulario. Sin esta `key`, React reutilizaria el componente y
          // arrastraria el borrador anterior al recien abierto.
          key={`${editando.kind}-${editando.id}`}
          ajustes={ajustes}
          kind={editando.kind}
          facturaId={editando.id === 'nuevo' ? null : editando.id}
          onSalir={() => {
            setEditando(null)
            // Los ajustes pueden haber cambiado (numeracion consumida).
            settings.get().then(setAjustes).catch(() => {})
          }}
          // Al convertir una cotizacion, saltamos a la factura resultante:
          // es lo que quieres mirar justo despues.
          onAbrirFactura={(factura) => {
            setSeccion('invoices')
            setEditando({ id: factura.id, kind: 'invoice' })
            settings.get().then(setAjustes).catch(() => {})
          }}
        />
      </>
    )
  }

  return (
    <AppShell
      seccion={seccion}
      onNavegar={setSeccion}
      onNuevaFactura={nuevoDocumento}
      etiquetaNuevo={v.nuevo}
      cuenta={cuenta}
      negocio={ajustes.business_name}
      onSalir={salir}
    >
      <DragStrip />
      {(seccion === 'invoices' || seccion === 'quotes') && (
        <Dashboard
          // Remonta el listado al cambiar de seccion, para que no se quede
          // un instante con las filas del tipo anterior.
          key={kindActual}
          kind={kindActual}
          moneda={moneda}
          onNuevaFactura={nuevoDocumento}
          onAbrirFactura={abrirDocumento}
        />
      )}
      {seccion === 'clients' && <Clients />}
      {seccion === 'services' && <Services moneda={moneda} />}
      {seccion === 'settings' && (
        <Settings cuenta={cuenta} onGuardado={setAjustes} />
      )}
    </AppShell>
  )
}
