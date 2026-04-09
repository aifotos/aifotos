import { User } from 'lucide-react'

export default function DatosCliente({ cliente, setCliente, modo }) {
  const handleChange = (e) => {
    setCliente({ ...cliente, [e.target.name]: e.target.value })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <User size={18} className="text-blue-600" />
        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Datos del Cliente</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Nombre / Empresa</label>
          <input
            name="nombre"
            value={cliente.nombre}
            onChange={handleChange}
            placeholder="Cliente S.A."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">RNC / Cédula</label>
          <input
            name="rnc"
            value={cliente.rnc}
            onChange={handleChange}
            placeholder="001-0000000-1"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Dirección</label>
          <input
            name="direccion"
            value={cliente.direccion}
            onChange={handleChange}
            placeholder="Av. 27 de Febrero, Santo Domingo"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            {modo === 'factura' ? 'No. Comprobante' : 'No. Cotización'}
          </label>
          <input
            name="comprobante"
            value={cliente.comprobante}
            onChange={handleChange}
            placeholder={modo === 'factura' ? 'B01-00000001' : 'COT-0001'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Fecha</label>
          <input
            type="date"
            name="fecha"
            value={cliente.fecha}
            onChange={handleChange}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  )
}
