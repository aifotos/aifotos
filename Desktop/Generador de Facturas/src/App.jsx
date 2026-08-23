import { FileText, Users, Package, CheckCircle2 } from 'lucide-react'

/**
 * Pantalla temporal de verificacion (Fase 1).
 * Confirma que Vite, React, Tailwind v4 y los tokens de diseno funcionan.
 * En la Fase 3 se reemplaza por el layout real del Dashboard.
 */
export default function App() {
  const checks = [
    { icon: CheckCircle2, label: 'Vite + React', detail: 'Servidor de desarrollo activo' },
    { icon: CheckCircle2, label: 'Tailwind CSS v4', detail: 'Tokens de diseno cargados' },
    { icon: CheckCircle2, label: 'Tauri v2', detail: 'Ventana nativa de macOS' },
    { icon: CheckCircle2, label: 'SQLite local', detail: 'Pendiente — Fase 2' },
  ]

  return (
    <div className="min-h-full flex items-center justify-center p-10">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <div className="size-11 rounded-xl bg-brand-600 flex items-center justify-center shadow-card">
            <FileText className="size-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">FacturaPro</h1>
            <p className="text-sm text-ink-soft">Facturacion para macOS</p>
          </div>
        </div>

        <div className="bg-surface rounded-card shadow-card border border-line divide-y divide-line">
          {checks.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-4">
              <Icon className="size-5 text-brand-500 shrink-0" strokeWidth={2} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="text-xs text-ink-soft">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <button className="flex-1 h-11 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
            Nueva factura
          </button>
          <button className="h-11 px-4 rounded-xl bg-surface border border-line text-ink text-sm font-medium hover:bg-canvas transition-colors inline-flex items-center gap-2">
            <Users className="size-4" /> Clientes
          </button>
          <button className="h-11 px-4 rounded-xl bg-surface border border-line text-ink text-sm font-medium hover:bg-canvas transition-colors inline-flex items-center gap-2">
            <Package className="size-4" /> Servicios
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Fase 1 completada. Siguiente: esquema de base de datos.
        </p>
      </div>
    </div>
  )
}
