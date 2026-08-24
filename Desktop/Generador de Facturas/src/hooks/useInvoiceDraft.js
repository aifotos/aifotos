import { useCallback, useEffect, useRef, useState } from 'react'
import { invoiceTotals } from '../lib/money.js'
import { today, addDays } from '../lib/dates.js'
import { DIAS_DE_VALIDEZ } from '../db/quotes.js'
import * as invoices from '../db/invoices.js'
import { registrarFallo } from '../lib/logging.js'

/** Una linea vacia, lista para escribir encima. */
export function lineaVacia() {
  return {
    // Clave estable para React. No puede ser el indice: al borrar una linea
    // del medio, React reutilizaria el estado del input equivocado.
    key: crypto.randomUUID(),
    service_id: null,
    description: '',
    quantity_milli: 1000,
    unit: 'unidad',
    unit_price_cents: 0,
  }
}

function borradorNuevo(ajustes, kind) {
  const emision = today()
  // La segunda fecha significa cosas distintas: una factura vence a los
  // dias de pago pactados; una cotizacion caduca al mes.
  const plazo = kind === 'quote' ? DIAS_DE_VALIDEZ : (ajustes.payment_terms_days ?? 15)
  return {
    id: null,
    number: null,
    kind,
    client: { name: '', email: '', phone: '', address: '', tax_id: '' },
    items: [lineaVacia()],
    issue_date: emision,
    due_date: addDays(emision, plazo),
    status: 'draft',
    discount_type: 'none',
    discount_value: 0,
    notes: ajustes.default_notes ?? '',
    payment_details: ajustes.payment_details ?? '',
    currency_symbol: ajustes.currency_symbol ?? 'RD$',
  }
}

/** Convierte una factura de la base al formato del formulario. */
function desdeLaBase(factura) {
  return {
    id: factura.id,
    number: factura.number,
    kind: factura.kind ?? 'invoice',
    converted_to_id: factura.converted_to_id ?? null,
    client: {
      name: factura.client_name,
      email: factura.client_email,
      phone: factura.client_phone,
      address: factura.client_address,
      tax_id: factura.client_tax_id,
    },
    items: factura.items.map((it) => ({ ...it, key: crypto.randomUUID() })),
    issue_date: factura.issue_date,
    due_date: factura.due_date,
    status: factura.status,
    discount_type: factura.discount_type,
    discount_value: factura.discount_value,
    notes: factura.notes,
    payment_details: factura.payment_details,
    currency_symbol: factura.currency_symbol,
  }
}

const RETRASO_AUTOGUARDADO = 1200

/**
 * Estado del editor de facturas, con autoguardado.
 *
 * El borrador se guarda solo ~1,2 s despues de que dejas de escribir. No se
 * guarda en cada tecla (serian decenas de transacciones por linea escrita)
 * ni en un intervalo fijo (guardaria mientras escribes, a media palabra).
 *
 * Un borrador NO consume numero de factura: usa una secuencia interna y
 * recibe su 'FAC-0007' definitivo solo al emitirlo. Asi, tres borradores
 * que nunca emites no dejan tres huecos en tu numeracion fiscal.
 */
export default function useInvoiceDraft({ ajustes, facturaId = null, kind = 'invoice' }) {
  const [borrador, setBorrador] = useState(null)
  const [estadoGuardado, setEstadoGuardado] = useState('limpio') // limpio | guardando | guardado | error
  const [cargando, setCargando] = useState(true)

  // Se guardan en refs, no en estado: el temporizador de autoguardado los
  // lee cuando dispara, y no debe reiniciarse cada vez que cambian.
  const pendiente = useRef(null)
  const temporizador = useRef(null)
  const guardando = useRef(false)

  // El id y el numero que asigno la base, fuera del estado de React.
  //
  // Estaban SOLO en el estado, y ahi se perdian: si un guardado fallaba, el
  // `setBorrador` que los devolvia nunca llegaba a ejecutarse y el siguiente
  // autoguardado volvia a entrar con id = null, creando OTRA factura. Asi
  // aparecieron diez borradores del mismo documento en tres minutos.
  // En un ref sobreviven al fallo y a cualquier orden de renderizado.
  const identidad = useRef({ id: facturaId, number: null })

  // --- Carga inicial -------------------------------------------------
  useEffect(() => {
    let vivo = true
    setCargando(true)
    const promesa = facturaId
      ? invoices.getFull(facturaId).then(desdeLaBase)
      : Promise.resolve(borradorNuevo(ajustes, kind))

    promesa
      .then((b) => {
        if (!vivo) return
        identidad.current = { id: b.id, number: b.number }
        setBorrador(b)
      })
      .catch((e) => {
        registrarFallo('editor: no se pudo cargar la factura', e)
        vivo && setEstadoGuardado('error')
      })
      .finally(() => vivo && setCargando(false))

    return () => {
      vivo = false
    }
    // Solo al montar o al cambiar de factura: `ajustes` no debe recargar
    // el formulario y perder lo que el usuario lleva escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturaId])

  // --- Guardado ------------------------------------------------------
  const guardarAhora = useCallback(async (siguiente) => {
    const base = siguiente ?? pendiente.current
    if (!base) return null

    // Ya hay un guardado en vuelo. No se descarta este: se deja pendiente
    // para que lo recoja el siguiente ciclo. Descartarlo perdia el ultimo
    // cambio escrito.
    if (guardando.current) {
      pendiente.current = base
      return null
    }

    // La identidad manda siempre sobre lo que traiga el formulario: es la
    // unica copia que no se pierde si un guardado anterior fallo.
    const aGuardar = { ...base, id: identidad.current.id ?? base.id ?? null }
    if (identidad.current.number) aGuardar.number = identidad.current.number

    // Un borrador completamente vacio no merece una fila en la base.
    if (!aGuardar.id && estaVacio(aGuardar)) return null

    guardando.current = true
    setEstadoGuardado('guardando')
    try {
      const guardada = await invoices.save(aGuardar)
      identidad.current = { id: guardada.id, number: guardada.number }
      setBorrador((b) => (b ? { ...b, id: guardada.id, number: guardada.number } : b))
      pendiente.current = null
      setEstadoGuardado('guardado')
      return guardada
    } catch (e) {
      registrarFallo('editor: no se pudo guardar la factura', e)
      // El borrador se queda pendiente para reintentar: si se descartara,
      // el siguiente guardado entraria sin id y duplicaria el documento.
      pendiente.current = aGuardar
      setEstadoGuardado('error')
      return null
    } finally {
      guardando.current = false
    }
  }, [])

  /** Modifica el borrador y programa el autoguardado. */
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
      temporizador.current = setTimeout(() => {
        guardarAhora()
      }, RETRASO_AUTOGUARDADO)
    },
    [guardarAhora],
  )

  // Guardar lo que quede pendiente al desmontar (por ejemplo, al volver al
  // Dashboard antes de que salte el temporizador).
  useEffect(() => {
    return () => {
      clearTimeout(temporizador.current)
      if (pendiente.current) guardarAhora(pendiente.current)
    }
  }, [guardarAhora])

  const totales = borrador
    ? invoiceTotals(borrador.items, borrador.discount_type, borrador.discount_value)
    : { subtotal_cents: 0, discount_cents: 0, total_cents: 0 }

  return { borrador, actualizar, guardarAhora, totales, estadoGuardado, cargando }
}

/** ¿Este borrador esta tan vacio que no vale la pena guardarlo? */
function estaVacio(b) {
  const sinCliente = !b.client.name?.trim()
  const sinLineas = b.items.every(
    (it) => !it.description?.trim() && !it.unit_price_cents,
  )
  return sinCliente && sinLineas
}
