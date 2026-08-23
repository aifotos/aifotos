/** Campo de formulario: etiqueta arriba, input debajo, ayuda opcional. */
export default function Field({ label, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-ink-soft mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-xs text-ink-faint">{hint}</span>}
    </label>
  )
}

/** Estilo compartido por todos los inputs de texto de la app. */
export const inputClass =
  'w-full h-10 px-3 rounded-xl bg-surface border border-line text-sm text-ink ' +
  'placeholder:text-ink-faint transition-colors ' +
  'focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

export const textareaClass =
  'w-full px-3 py-2.5 rounded-xl bg-surface border border-line text-sm text-ink ' +
  'placeholder:text-ink-faint resize-y min-h-20 transition-colors ' +
  'focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100'
