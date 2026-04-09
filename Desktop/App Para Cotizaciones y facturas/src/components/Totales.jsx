import { Calculator } from 'lucide-react'

export default function Totales({ subtotal, itbis, total, tasaItbis, setTasaItbis }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Calculator size={18} className="text-blue-600" />
        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Resumen</h2>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500">Subtotal</span>
          <span className="font-medium text-slate-700">
            RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">ITBIS</span>
            <input
              type="number"
              min="0"
              max="100"
              value={tasaItbis}
              onChange={(e) => setTasaItbis(parseFloat(e.target.value) || 0)}
              className="w-14 border border-slate-200 rounded px-2 py-0.5 text-xs text-center text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-slate-400 text-xs">%</span>
          </div>
          <span className="font-medium text-slate-700">
            RD$ {itbis.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
          <span className="text-slate-800 font-bold">Total General</span>
          <span className="text-xl font-bold text-blue-600">
            RD$ {total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  )
}
