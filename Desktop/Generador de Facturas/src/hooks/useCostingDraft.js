import { useCallback, useEffect, useRef, useState } from 'react'
import { calcularCosteo } from '../lib/costeo.js'
import { today } from '../lib/dates.js'
import * as costings from '../db/costings.js'
import { registrarFallo } from '../lib/logging.js'

/** Una linea vacia, lista para escribir encima. */
export function lineaVacia(ajustes, category = 'material') {
  return {
    // Clave estable para React. No puede ser el indice: al borrar una
    // linea del medio, React reutilizaria el estado del input equivocado.
    key: crypto.randomUUID(),
    category,
    description: '',
    supplier: '',
    sku: '',
    quantity_milli: 1000,
    cost_cents: 0,
    delivery_cents: 0,
    price_mode: 'margin',
    margin_bp: margenPorDefecto(ajustes, category),
    manual_price_cents: 0,
    double_reason: '',
    real_cost_cents: null,
  }
}

/** El margen con el que arranca una linea segun lo que sea. */
export function margenPorDefecto(ajustes, category) {
  return category === 'labor'
    ? (ajustes?.margin_labor_bp ?? 2000)
    : (ajustes?.margin_material_bp ?? 2000)
}

function costeoNuevo(ajustes) {
  return {
    id: null,
    number: null,
    title: '',
    issue_date: today(),
    client_name: '',
    supplier: '',
    supplier_ref: '',
    price_mode: 'business',
    discount_mode: 'none',
    discount_bp: 0,
    notes: '',
    quote_id: null,
    quote_number: null,
    lineas: [lineaVacia(ajustes)],
  }
}

function desdeLaBase(costeo) {
  return {
    ...costeo,
    lineas: costeo.lineas.map((l) => ({ ...l, key: crypto.randomUUID() })),
  }
}

const RETRASO_AUTOGUARDADO = 1200

/**
 * Estado del editor de costeos, con autoguardado.
 *
 * Es el mismo patron que el editor de facturas, y lo importante es el ref
 * `identidad`: el id y el numero que asigno la base viven FUERA del estado
 * de React. Estando solo en el estado se perdian cuando un guardado
 * fallaba —el setState que los devolvia nunca llegaba a ejecutarse— y el
 * siguiente autoguardado entraba con id = null y creaba OTRO documento.
 * Asi aparecieron una vez diez borradores de la misma factura en tres
 * minutos. En un ref sobreviven al fallo.
 */
export default function useCostingDraft({ ajustes, costeoId = null }) {
  const [borrador, setBorrador] = useState(null)
  const [estadoGuardado, setEstadoGuardado] = useState('limpio')
  const [cargando, setCargando] = useState(true)

  const pendiente = useRef(null)
  const temporizador = useRef(null)
  const guardando = useRef(false)
  const identidad = useRef({ id: costeoId, number: null })

  useEffect(() => {
    let vivo = true
    setCargando(true)
    const promesa = costeoId
      ? costings.getFull(costeoId).then(desdeLaBase)
      : Promise.resolve(costeoNuevo(ajustes))

    promesa
      .then((b) => {
        if (!vivo) return
        identidad.current = { id: b.id, number: b.number }
        setBorrador(b)
      })
      .catch((e) => {
        registrarFallo('costeo: no se pudo cargar', e)
        vivo && setEstadoGuardado('error')
      })
      .finally(() => vivo && setCargando(false))

    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costeoId])

  const guardarAhora = useCallback(async (siguiente) => {
    const base = siguiente ?? pendiente.current
    if (!base) return null

    // Ya hay un guardado en vuelo: este se deja pendiente en vez de
    // descartarse, o se perderia el ultimo cambio escrito.
    if (guardando.current) {
      pendiente.current = base
      return null
    }

    const aGuardar = { ...base, id: identidad.current.id ?? base.id ?? null }
    if (identidad.current.number) aGuardar.number = identidad.current.number

    // Un costeo en blanco no merece una fila ni gastar un numero.
    if (!aGuardar.id && estaVacio(aGuardar)) return null

    guardando.current = true
    setEstadoGuardado('guardando')
    try {
      const guardado = await costings.save(aGuardar)
      identidad.current = { id: guardado.id, number: guardado.number }
      setBorrador((b) => (b ? { ...b, id: guardado.id, number: guardado.number } : b))
      pendiente.current = null
      setEstadoGuardado('guardado')
      return guardado
    } catch (e) {
      registrarFallo('costeo: no se pudo guardar', e)
      // Se queda pendiente para reintentar. Descartarlo haria que el
      // siguiente guardado entrara sin id y duplicara el documento.
      pendiente.current = aGuardar
      setEstadoGuardado('error')
      return null
    } finally {
      guardando.current = false
    }
  }, [])

  const actualizar = useCallback(
    (cambio) => {
      setBorrador((actual) => {
        if (!actual) return actual
        const siguiente = typeof cambio === 'function' ? cambio(actual) : { ...actual, ...cambio }
        pendiente.current = siguiente
        return siguiente
      })
      setEstadoGuardado('limpio')
      clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => { guardarAhora() }, RETRASO_AUTOGUARDADO)
    },
    [guardarAhora],
  )

  useEffect(() => {
    return () => {
      clearTimeout(temporizador.current)
      if (pendiente.current) guardarAhora(pendiente.current)
    }
  }, [guardarAhora])

  // Se recalcula en cada render y no se guarda en estado: el total es una
  // consecuencia de las lineas, y un total en estado es un total que puede
  // quedarse viejo. Es la misma funcion que usa `save`.
  const totales = calcularCosteo(borrador?.lineas ?? [], {
    margin_secondary_bp: ajustes.margin_secondary_bp,
    rounding_primary_cents: ajustes.rounding_primary_cents,
    rounding_secondary_cents: ajustes.rounding_secondary_cents,
    price_mode: borrador?.price_mode ?? 'business',
    discount_mode: borrador?.discount_mode ?? 'none',
    discount_bp: borrador?.discount_bp ?? 0,
  })

  return { borrador, actualizar, guardarAhora, totales, estadoGuardado, cargando }
}

function estaVacio(b) {
  return (
    !b.title?.trim() &&
    !b.client_name?.trim() &&
    b.lineas.every((l) => !l.description?.trim() && !l.cost_cents)
  )
}
