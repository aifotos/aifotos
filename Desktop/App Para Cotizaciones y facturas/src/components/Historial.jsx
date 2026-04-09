import { useState } from 'react'
import { X, Trash2, FileText, Receipt, Search, TrendingUp } from 'lucide-react'

export default function Historial({ historial, onEliminar, onCargar, onCerrar }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const fmt = (n) => Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 })

  const filtrados = historial.filter((r) => {
    const matchTipo = filtro === 'todos' || r.tipo === filtro
    const q = busqueda.toLowerCase()
    const matchBusqueda =
      !q ||
      r.numero.toLowerCase().includes(q) ||
      r.clienteNombre.toLowerCase().includes(q) ||
      (r.clienteRnc && r.clienteRnc.includes(q))
    return matchTipo && matchBusqueda
  })

  const totalFacturado = historial
    .filter((r) => r.tipo === 'factura')
    .reduce((acc, r) => acc + Number(r.total), 0)

  const totalCotizado = historial
    .filter((r) => r.tipo === 'cotizacion')
    .reduce((acc, r) => acc + Number(r.total), 0)

  const formatFecha = (str) => {
    if (!str) return '—'
    return new Date(str + (str.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-DO', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Historial de Documentos</h2>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total documentos</p>
            <p className="text-2xl font-bold text-slate-800">{historial.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total cotizado</p>
            <p className="text-lg font-bold text-blue-600">RD$ {fmt(totalCotizado)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total facturado</p>
            <p className="text-lg font-bold text-emerald-600">RD$ {fmt(totalFacturado)}</p>
          </div>
        </div>

        {/* Filtros y búsqueda */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por número, cliente o RNC..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            {[['todos', 'Todos'], ['cotizacion', 'Cotizaciones'], ['factura', 'Facturas']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFiltro(val)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  filtro === val ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <TrendingUp size={36} className="mb-3 opacity-30" />
              <p className="font-medium">Sin registros</p>
              <p className="text-sm">Los documentos exportados aparecerán aquí</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-6 py-3 font-medium">Número</th>
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {r.tipo === 'cotizacion'
                          ? <FileText size={15} className="text-blue-500 shrink-0" />
                          : <Receipt size={15} className="text-emerald-500 shrink-0" />
                        }
                        <span className="font-mono font-semibold text-slate-700">{r.numero}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{r.clienteNombre}</p>
                      {r.clienteRnc && <p className="text-xs text-slate-400">{r.clienteRnc}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatFecha(r.fecha)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                      RD$ {fmt(r.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { onCargar(r); onCerrar() }}
                          className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors"
                        >
                          Abrir
                        </button>
                        {confirmDelete === r.id ? (
                          <button
                            onClick={() => { onEliminar(r.id); setConfirmDelete(null) }}
                            className="text-xs px-2.5 py-1 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 font-medium transition-colors"
                          >
                            ¿Seguro?
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(r.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
