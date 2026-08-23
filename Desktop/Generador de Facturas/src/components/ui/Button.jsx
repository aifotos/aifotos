/**
 * Boton. Tres variantes y tres tamanos, nada mas — si hace falta una cuarta,
 * casi siempre es senal de que el diseno se esta dispersando.
 */
const VARIANTES = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 shadow-sm',
  secondary:
    'bg-surface text-ink border border-line hover:bg-canvas active:bg-line/60',
  ghost:
    'text-ink-soft hover:text-ink hover:bg-line/50 active:bg-line',
  danger:
    'bg-surface text-overdue-ink border border-line hover:bg-overdue-bg',
}

const TAMANOS = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium
        transition-colors duration-100 select-none whitespace-nowrap
        disabled:opacity-40 disabled:pointer-events-none
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500
        ${VARIANTES[variant]} ${TAMANOS[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2} />}
      {children}
    </button>
  )
}
