import { FileText, FileSignature, Users, Package, Settings, Plus } from 'lucide-react'
import Button from '../ui/Button.jsx'

const SECCIONES = [
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
export default function Sidebar({ actual, onNavegar, onNuevaFactura, etiquetaNuevo = 'Nueva factura' }) {
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

      <div className="p-3 text-[11px] text-ink-faint">
        FacturaPro · datos guardados en este Mac
      </div>
    </aside>
  )
}
