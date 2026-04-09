import { FileText, ToggleLeft, ToggleRight, History } from 'lucide-react'

export default function Header({ modo, setModo, totalDocumentos, onVerHistorial }) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg">
          <FileText className="text-white" size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">FacturaPro</h1>
          <p className="text-xs text-slate-500">Cotizaciones y Facturas</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Botón historial */}
        <button
          onClick={onVerHistorial}
          className="relative flex items-center gap-1.5 text-slate-600 hover:text-blue-600 text-sm font-medium transition-colors"
        >
          <History size={18} />
          <span className="hidden sm:inline">Historial</span>
          {totalDocumentos > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {totalDocumentos > 99 ? '99' : totalDocumentos}
            </span>
          )}
        </button>

        <div className="w-px h-6 bg-slate-200" />

        {/* Toggle modo */}
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${modo === 'cotizacion' ? 'text-blue-600' : 'text-slate-400'}`}>
            Cotización
          </span>
          <button
            onClick={() => setModo(modo === 'cotizacion' ? 'factura' : 'cotizacion')}
            className="text-blue-600 hover:text-blue-700 transition-colors"
          >
            {modo === 'cotizacion'
              ? <ToggleLeft size={40} />
              : <ToggleRight size={40} className="text-emerald-600" />
            }
          </button>
          <span className={`text-sm font-medium ${modo === 'factura' ? 'text-emerald-600' : 'text-slate-400'}`}>
            Factura
          </span>
        </div>
      </div>
    </header>
  )
}
