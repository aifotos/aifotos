import { Plus, BookOpen } from 'lucide-react'
import { CATALOGO_SERVICIOS } from '../data/servicios'

export default function CatalogoServicios({ onAgregar }) {
  const formatPrecio = (precio) =>
    precio.toLocaleString('es-DO', { minimumFractionDigits: 2 })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <BookOpen size={18} className="text-blue-600" />
        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
          Catálogo de Servicios
        </h2>
        <span className="ml-auto text-xs text-slate-400">Clic para agregar a la tabla</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-4">
        {CATALOGO_SERVICIOS.map((servicio) => (
          <button
            key={servicio.id}
            onClick={() => onAgregar(servicio)}
            className="flex items-center justify-between gap-3 text-left border border-slate-200 rounded-lg px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50 transition-all group"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 group-hover:text-blue-700 truncate">
                {servicio.nombre}
              </p>
              <p className="text-xs text-slate-400 truncate">{servicio.descripcion}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-semibold text-slate-600 group-hover:text-blue-600">
                RD$ {formatPrecio(servicio.precio)}
              </span>
              <div className="bg-slate-100 group-hover:bg-blue-600 rounded-full p-0.5 transition-colors">
                <Plus size={13} className="text-slate-400 group-hover:text-white" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
