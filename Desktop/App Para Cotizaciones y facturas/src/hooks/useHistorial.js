import { useState, useEffect } from 'react'

const STORAGE_KEY = 'facturapro_historial'
const CONTADORES_KEY = 'facturapro_contadores'

const contadoresIniciales = { cotizacion: 0, factura: 0 }

export function useHistorial() {
  const [historial, setHistorial] = useState([])
  const [contadores, setContadores] = useState(contadoresIniciales)

  useEffect(() => {
    const savedHistorial = localStorage.getItem(STORAGE_KEY)
    const savedContadores = localStorage.getItem(CONTADORES_KEY)
    if (savedHistorial) setHistorial(JSON.parse(savedHistorial))
    if (savedContadores) setContadores(JSON.parse(savedContadores))
  }, [])

  const generarNumero = (tipo) => {
    const num = (contadores[tipo] || 0) + 1
    const prefijo = tipo === 'cotizacion' ? 'COT' : 'FAC'
    return `${prefijo}-${String(num).padStart(4, '0')}`
  }

  const guardarDocumento = ({ tipo, numero, emisor, cliente, articulos, subtotal, itbis, total, tasaItbis }) => {
    const nuevoContador = (contadores[tipo] || 0) + 1
    const nuevosContadores = { ...contadores, [tipo]: nuevoContador }

    const registro = {
      id: Date.now(),
      tipo,
      numero,
      clienteNombre: cliente.nombre || 'Sin nombre',
      clienteRnc: cliente.rnc || '',
      fecha: cliente.fecha,
      fechaCreacion: new Date().toISOString(),
      subtotal,
      itbis,
      total,
      tasaItbis,
      snapshot: { emisor, cliente, articulos },
    }

    const nuevoHistorial = [registro, ...historial]

    setContadores(nuevosContadores)
    setHistorial(nuevoHistorial)
    localStorage.setItem(CONTADORES_KEY, JSON.stringify(nuevosContadores))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevoHistorial))

    // Devolver el siguiente número para que App lo use de inmediato
    const prefijo = tipo === 'cotizacion' ? 'COT' : 'FAC'
    const siguienteNumero = `${prefijo}-${String(nuevoContador + 1).padStart(4, '0')}`
    return { siguienteNumero }
  }

  const eliminarRegistro = (id) => {
    const actualizado = historial.filter((r) => r.id !== id)
    setHistorial(actualizado)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizado))
  }

  return { historial, contadores, generarNumero, guardarDocumento, eliminarRegistro }
}
