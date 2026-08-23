/** Pantalla vacia: icono, titulo, una linea de explicacion y una accion. */
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      {Icon && (
        <div className="size-14 rounded-2xl bg-canvas border border-line flex items-center justify-center mb-5">
          <Icon className="size-6 text-ink-faint" strokeWidth={1.75} />
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-ink-soft max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
