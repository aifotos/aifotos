import { Plus, Trash2, ShoppingCart } from 'lucide-react'

export default function TablaArticulos({ articulos, setArticulos }) {
  const handleChange = (index, field, value) => {
    const updated = articulos.map((art, i) => {
      if (i !== index) return art
      const nuevo = { ...art, [field]: value }
      if (field === 'cantidad' || field === 'precio') {
        const cant = field === 'cantidad' ? parseFloat(value) || 0 : parseFloat(art.cantidad) || 0
        const prec = field === 'precio' ? parseFloat(value) || 0 : parseFloat(art.precio) || 0
        nuevo.total = (cant * prec).toFixed(2)
      }
      return nuevo
    })
    setArticulos(updated)
  }

  const agregarFila = () => {
    setArticulos([...articulos, { descripcion: '', cantidad: '', precio: '', total: '0.00' }])
  }

  const eliminarFila = (index) => {
    if (articulos.length === 1) return
    setArticulos(articulos.filter((_, i) => i !== index))
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-blue-600" />
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Artículos / Servicios</h2>
        </div>
        <button
          onClick={agregarFila}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Añadir fila
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium w-1/2">Descripción</th>
              <th className="text-center px-4 py-3 font-medium w-20">Cant.</th>
              <th className="text-right px-4 py-3 font-medium w-32">Precio Unit.</th>
              <th className="text-right px-4 py-3 font-medium w-32">Total</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {articulos.map((art, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2">
                  <input
                    value={art.descripcion}
                    onChange={(e) => handleChange(i, 'descripcion', e.target.value)}
                    placeholder="Descripción del servicio o producto"
                    className="w-full border-0 bg-transparent text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-1"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min="0"
                    value={art.cantidad}
                    onChange={(e) => handleChange(i, 'cantidad', e.target.value)}
                    placeholder="1"
                    className="w-full border-0 bg-transparent text-center text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-1"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={art.precio}
                    onChange={(e) => handleChange(i, 'precio', e.target.value)}
                    placeholder="0.00"
                    className="w-full border-0 bg-transparent text-right text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-1"
                  />
                </td>
                <td className="px-4 py-2 text-right font-medium text-slate-700">
                  RD$ {parseFloat(art.total || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => eliminarFila(i)}
                    disabled={articulos.length === 1}
                    className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
