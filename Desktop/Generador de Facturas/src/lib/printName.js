/** Nombre sugerido sin extensión: macOS añade .pdf al guardar. */
export function printName(documento) {
  const tipo = documento.kind === 'quote' ? 'Cotización' : 'Factura'
  const numero = String(documento.number ?? '').trim() || `${tipo} - Borrador`
  const cliente = String(documento.client_name ?? documento.client?.name ?? '').trim() || 'Sin cliente'
  return `${numero} - ${cliente}`
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 160)
}
