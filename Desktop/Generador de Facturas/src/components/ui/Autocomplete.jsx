import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useDebounced from '../../hooks/useDebounced.js'

const ALTO_MAXIMO = 256
// La columna "Descripción" de la tabla de conceptos es estrecha; sin un
// minimo, la sugerencia sale recortada a "Video promo…" y no se puede leer.
const ANCHO_MINIMO = 300

/**
 * Campo de texto con sugerencias de la base de datos.
 *
 * Es un campo libre, no un desplegable: siempre puedes escribir algo que
 * no esta en la lista. Esa es justamente la premisa del auto-guardado —
 * lo que escribes nuevo se aprende, no se rechaza.
 *
 * La lista se dibuja en un portal con posicion fija, no dentro del campo.
 * Tiene que ser asi: el formulario esta dentro de un panel con scroll y la
 * tabla de conceptos tiene las esquinas redondeadas con `overflow-hidden`,
 * de modo que una lista posicionada normalmente quedaria recortada — y en
 * la ultima linea de la factura, invisible del todo.
 *
 * Teclado: flechas para moverse, Enter para elegir, Escape para cerrar.
 *
 * @param {(t:string)=>Promise<Array>} buscar     consulta a src/db/
 * @param {(item:object)=>void}        onElegir   al aceptar una sugerencia
 * @param {(item:object)=>ReactNode}   children   como se pinta cada sugerencia
 */
export default function Autocomplete({
  value,
  onChange,
  onElegir,
  buscar,
  children,
  className = '',
  minimo = 0,
  ...props
}) {
  const [sugerencias, setSugerencias] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [resaltado, setResaltado] = useState(-1)
  const [caja, setCaja] = useState(null)

  const campo = useRef(null)
  const lista = useRef(null)
  const listaId = useId()

  const termino = useDebounced(value ?? '', 160)

  // --- Buscar --------------------------------------------------------
  useEffect(() => {
    if (!abierto) return
    if ((termino ?? '').trim().length < minimo) {
      setSugerencias([])
      return
    }
    let vivo = true
    buscar(termino).then((filas) => {
      if (!vivo) return
      setSugerencias(filas)
      setResaltado(-1)
    })
    return () => {
      vivo = false
    }
  }, [termino, abierto, minimo, buscar])

  // --- Colocar la lista pegada al campo ------------------------------
  const recolocar = useCallback(() => {
    const nodo = campo.current
    if (!nodo) return
    const r = nodo.getBoundingClientRect()
    const debajo = window.innerHeight - r.bottom
    // Si no cabe debajo pero si encima, se despliega hacia arriba.
    const haciaArriba = debajo < ALTO_MAXIMO && r.top > debajo
    const ancho = Math.max(r.width, ANCHO_MINIMO)
    setCaja({
      // Si el minimo hace que la lista se salga por la derecha, se alinea
      // por el borde derecho del campo en lugar de por el izquierdo.
      left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)),
      width: ancho,
      top: haciaArriba ? undefined : r.bottom + 4,
      bottom: haciaArriba ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.min(ALTO_MAXIMO, (haciaArriba ? r.top : debajo) - 12),
    })
  }, [])

  useLayoutEffect(() => {
    if (!abierto) return
    recolocar()
    // `true` para capturar el scroll de CUALQUIER contenedor, no solo el de
    // la ventana: el formulario vive dentro de un panel con scroll propio.
    window.addEventListener('scroll', recolocar, true)
    window.addEventListener('resize', recolocar)
    return () => {
      window.removeEventListener('scroll', recolocar, true)
      window.removeEventListener('resize', recolocar)
    }
  }, [abierto, recolocar, sugerencias.length])

  // --- Cerrar al pulsar fuera ----------------------------------------
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => {
      if (campo.current?.contains(e.target) || lista.current?.contains(e.target)) return
      setAbierto(false)
    }
    // 'mousedown' y no 'click': la lista debe cerrarse antes de que el
    // navegador mueva el foco.
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  function elegir(item) {
    onElegir?.(item)
    setAbierto(false)
    setResaltado(-1)
  }

  function alTeclear(e) {
    if (!abierto || sugerencias.length === 0) {
      if (e.key === 'ArrowDown') setAbierto(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setResaltado((i) => (i + 1) % sugerencias.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltado((i) => (i - 1 + sugerencias.length) % sugerencias.length)
    } else if (e.key === 'Enter' && resaltado >= 0) {
      e.preventDefault()
      elegir(sugerencias[resaltado])
    } else if (e.key === 'Escape') {
      setAbierto(false)
    } else if (e.key === 'Tab') {
      setAbierto(false)
    }
  }

  const visible = abierto && sugerencias.length > 0 && caja

  return (
    <>
      <input
        ref={campo}
        value={value ?? ''}
        onChange={(e) => {
          onChange(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTeclear}
        role="combobox"
        aria-expanded={!!visible}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        className={className}
        {...props}
      />

      {visible &&
        createPortal(
          <ul
            ref={lista}
            id={listaId}
            role="listbox"
            style={{ position: 'fixed', ...caja, overflowY: 'auto' }}
            className="z-50 bg-surface border border-line rounded-xl shadow-pop py-1"
          >
            {sugerencias.map((item, i) => (
              <li
                key={item.id}
                role="option"
                aria-selected={i === resaltado}
                onMouseEnter={() => setResaltado(i)}
                onMouseDown={(e) => {
                  // mousedown, no click: el input pierde el foco antes del
                  // click y la lista ya se habria cerrado.
                  e.preventDefault()
                  elegir(item)
                }}
                className={`px-3 py-2 cursor-default ${i === resaltado ? 'bg-brand-50' : ''}`}
              >
                {children(item)}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}
