import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, Search } from 'lucide-react'
import useAnclaFlotante, { useCerrarAlPulsarFuera } from '../../hooks/useAnclaFlotante.js'

/**
 * Selector de un registro guardado, con buscador y opcion de crear uno nuevo.
 *
 * A diferencia de un campo de texto con sugerencias, aqui NO se puede
 * escribir cualquier cosa: se elige de la lista o se crea, y crear es un
 * gesto explicito que abre un formulario y guarda el registro. El campo
 * libre era comodo pero dejaba al usuario sin saber si lo que escribio se
 * habia guardado o no.
 *
 * @param {object|null} valor        el registro elegido
 * @param {(t:string)=>Promise<Array>} buscar
 * @param {(item:object)=>void}    onElegir
 * @param {(texto:string)=>void}   onCrear    recibe lo escrito en el buscador
 * @param {(item:object)=>ReactNode} children como se pinta cada opcion
 */
export default function Picker({
  valor,
  buscar,
  onElegir,
  onCrear,
  children,
  placeholder = 'Seleccionar…',
  etiquetaCrear = 'Crear nuevo',
  textoDe = (x) => x?.name ?? '',
  className = '',
  recargar = 0,
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [opciones, setOpciones] = useState([])
  const [resaltado, setResaltado] = useState(0)

  const { ancla, caja } = useAnclaFlotante({
    abierto,
    anchoMinimo: 300,
    dependencias: [opciones.length],
  })
  const panel = useRef(null)
  const campo = useRef(null)
  const listaId = useId()

  useCerrarAlPulsarFuera(abierto, () => setAbierto(false), [ancla, panel])

  useEffect(() => {
    if (!abierto) return
    let vivo = true
    buscar(texto).then((filas) => vivo && (setOpciones(filas), setResaltado(0)))
    return () => {
      vivo = false
    }
  }, [texto, abierto, buscar, recargar])

  // El foco va al buscador al abrir, no al boton: se abre para buscar.
  //
  // Depende tambien de `caja` porque el panel NO existe en el primer
  // renderizado tras abrir: hasta que `useAnclaFlotante` no mide el ancla,
  // `caja` es null y el portal no se monta. Mirando solo `abierto`, el
  // foco se pedia sobre un input que aun no estaba en el DOM y las
  // primeras pulsaciones se perdian.
  useEffect(() => {
    if (abierto && caja) campo.current?.focus()
  }, [abierto, caja])

  useEffect(() => {
    if (!abierto) setTexto('')
  }, [abierto])

  function elegir(item) {
    onElegir(item)
    setAbierto(false)
  }

  function crear() {
    onCrear(texto.trim())
    setAbierto(false)
  }

  function alTeclear(e) {
    const total = opciones.length + 1 // +1 por la opcion de crear
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setResaltado((i) => (i + 1) % total)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltado((i) => (i - 1 + total) % total)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (resaltado < opciones.length) elegir(opciones[resaltado])
      else crear()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setAbierto(false)
    }
  }

  return (
    <>
      <button
        ref={ancla}
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listaId}
        className={`w-full h-10 px-3 rounded-xl bg-surface border border-line
          flex items-center justify-between gap-2 text-sm text-left transition-colors
          hover:border-line-strong
          focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
          ${valor ? 'text-ink' : 'text-ink-faint'} ${className}`}
      >
        {/* `min-w-0` junto a `truncate`: sin el no corta nada. Un hijo
            de flex arranca con `min-width:auto`, que le prohibe encogerse
            por debajo de su contenido, y como `truncate` ademas pone
            `white-space:nowrap`, el texto entero cuenta como tamano
            minimo y empuja todo lo que tenga al lado. */}
        <span className="truncate min-w-0">{valor ? textoDe(valor) : placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-ink-faint" strokeWidth={2} />
      </button>

      {abierto &&
        caja &&
        createPortal(
          <div
            ref={panel}
            style={{ position: 'fixed', ...caja }}
            className="no-print z-50 bg-surface border border-line rounded-xl
              shadow-pop overflow-hidden flex flex-col"
          >
            <div className="relative border-b border-line shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-faint pointer-events-none" />
              <input
                ref={campo}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={alTeclear}
                placeholder="Buscar…"
                className="w-full h-10 pl-9 pr-3 bg-transparent text-sm text-ink
                  placeholder:text-ink-faint focus:outline-none"
              />
            </div>

            <ul id={listaId} role="listbox" className="overflow-y-auto py-1 min-h-0">
              {opciones.map((item, i) => (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={i === resaltado}
                  onMouseEnter={() => setResaltado(i)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    elegir(item)
                  }}
                  className={`px-3 py-2 cursor-default ${i === resaltado ? 'bg-brand-50' : ''}`}
                >
                  {children(item)}
                </li>
              ))}

              {opciones.length === 0 && (
                <li className="px-3 py-3 text-xs text-ink-faint">
                  {texto.trim() ? 'Nada coincide' : 'Todavía no hay ninguno'}
                </li>
              )}
            </ul>

            <button
              type="button"
              onMouseEnter={() => setResaltado(opciones.length)}
              onMouseDown={(e) => {
                e.preventDefault()
                crear()
              }}
              className={`shrink-0 h-10 px-3 flex items-center gap-2 text-sm font-medium
                text-brand-700 border-t border-line transition-colors
                ${resaltado === opciones.length ? 'bg-brand-50' : 'hover:bg-brand-50'}`}
            >
              <Plus className="size-4 shrink-0" strokeWidth={2} />
              <span className="truncate">
                {texto.trim() ? `Crear «${texto.trim()}»` : etiquetaCrear}
              </span>
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
