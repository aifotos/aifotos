import { FileText, FileSignature, Users, Package, Settings, Plus, LogOut, BarChart3, Wallet } from 'lucide-react'
import Button from '../ui/Button.jsx'

const SECCIONES = [
  { id: 'analytics', label: 'Dashboard', icon: BarChart3 },
  { id: 'costs', label: 'Costos y gastos', icon: Wallet },
  { id: 'invoices', label: 'Facturas', icon: FileText },
  { id: 'quotes', label: 'Cotizaciones', icon: FileSignature },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'services', label: 'Servicios', icon: Package },
  { id: 'settings', label: 'Ajustes', icon: Settings },
]

/**
 * Barra lateral fija.
 *
 * El `pt-11` de arriba y el `data-tauri-drag-region` no son decorativos:
 * la ventana usa `titleBarStyle: "Overlay"`, asi que no hay barra de titulo
 * y los tres botones de macOS flotan sobre esta columna. El padding les deja
 * sitio y el atributo convierte esa franja en zona de arrastre, para que la
 * ventana se pueda mover como cualquier otra app.
 */
export default function Sidebar({
  actual, onNavegar, onNuevaFactura, etiquetaNuevo = 'Nueva factura',
  cuenta, negocio, onSalir,
}) {
  return (
    <aside className="w-56 shrink-0 bg-canvas border-r border-line flex flex-col">
      {/* Hueco para los semaforos de macOS. El arrastre lo gestiona
          DragStrip, una franja aparte que cubre todo el ancho. */}
      <div className="h-11 shrink-0" />

      <div className="px-3 pb-3">
        <Button
          variant="primary"
          size="md"
          icon={Plus}
          className="w-full"
          onClick={onNuevaFactura}
        >
          {etiquetaNuevo}
        </Button>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {SECCIONES.map(({ id, label, icon: Icon }) => {
          const activo = actual === id
          return (
            <button
              key={id}
              onClick={() => onNavegar(id)}
              className={`w-full h-9 px-2.5 rounded-lg flex items-center gap-2.5
                text-sm font-medium transition-colors duration-100
                ${
                  activo
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-soft hover:text-ink hover:bg-line/50'
                }`}
            >
              <Icon
                className={`size-4 shrink-0 ${activo ? 'text-brand-600' : ''}`}
                strokeWidth={2}
              />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Que cuenta esta abierta, siempre a la vista.
          Es la unica pista de que estas facturando por el negocio que
          crees: los dos historiales se ven identicos, y equivocarse de
          cuenta solo se nota cuando la factura ya lleva el logo del otro. */}
      <div className="p-3 border-t border-line">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ink truncate">
              {negocio?.trim() || cuenta?.display_name}
            </p>
            <p className="text-[11px] text-ink-faint truncate">
              {cuenta?.username} · datos en este Mac
            </p>
          </div>
          <button
            onClick={onSalir}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="size-8 shrink-0 rounded-lg flex items-center justify-center
              text-ink-faint hover:text-ink hover:bg-line/60 transition-colors"
          >
            <LogOut className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  )
}
