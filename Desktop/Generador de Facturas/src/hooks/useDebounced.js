import { useEffect, useState } from 'react'

/**
 * Retrasa un valor hasta que deja de cambiar durante `ms`.
 *
 * Sin esto, cada tecla lanzaria una consulta a la base: escribir
 * "Restaurante" son once consultas de las que solo importa la ultima.
 */
export default function useDebounced(valor, ms = 180) {
  const [retrasado, setRetrasado] = useState(valor)

  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])

  return retrasado
}
