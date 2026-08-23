/**
 * Cabecera de seccion. La franja superior es zona de arrastre de la ventana
 * (la barra de titulo nativa esta oculta), asi que se puede mover la app
 * arrastrando desde aqui.
 */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header
      className="sticky top-0 z-10 bg-canvas/85 backdrop-blur-xl border-b border-line"
      data-tauri-drag-region
    >
      <div className="px-8 pt-11 pb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
