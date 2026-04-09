import { Building2 } from 'lucide-react'

export default function DatosEmisor({ emisor, setEmisor }) {
  const handleChange = (e) => {
    setEmisor({ ...emisor, [e.target.name]: e.target.value })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={18} className="text-blue-600" />
        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Mi Empresa</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Nombre / Razón Social</label>
          <input
            name="nombre"
            value={emisor.nombre}
            onChange={handleChange}
            placeholder="Mi Empresa S.R.L."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">RNC / Cédula</label>
          <input
            name="rnc"
            value={emisor.rnc}
            onChange={handleChange}
            placeholder="101-00000-1"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Dirección</label>
          <input
            name="direccion"
            value={emisor.direccion}
            onChange={handleChange}
            placeholder="Calle Principal #123, Santo Domingo"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Teléfono</label>
          <input
            name="telefono"
            value={emisor.telefono}
            onChange={handleChange}
            placeholder="(809) 000-0000"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Correo Electrónico</label>
          <input
            name="email"
            value={emisor.email}
            onChange={handleChange}
            placeholder="info@miempresa.com"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  )
}
