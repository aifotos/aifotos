/**
 * Todo lo que distingue una factura de una cotizacion en pantalla.
 *
 * Vive en un solo archivo a proposito. La alternativa —sembrar
 * `kind === 'quote' ? … : …` por los componentes— convierte cada cambio de
 * texto en una caceria, y garantiza que dentro de un mes haya una pantalla
 * llamando "vencimiento" a la fecha de validez de un presupuesto.
 */
export const DOCUMENTOS = {
  invoice: {
    kind: 'invoice',
    seccion: 'Facturas',
    singular: 'factura',
    articulo: 'la',
    nuevo: 'Nueva factura',
    // Encabezado del PDF
    tituloDocumento: 'Factura',
    etiquetaNumero: 'Factura No:',
    // La segunda fecha significa cosas distintas en cada documento
    etiquetaFecha: 'Vencimiento',
    etiquetaFechaDoc: 'Vence',
    // Sacarlo de borrador
    accionEmitir: 'Emitir factura',
    verboEmitido: 'emitida',
    estadoAlEmitir: 'pending',
    // El paso siguiente
    accionCerrar: 'Marcar como pagada',
    estadoCerrado: 'paid',
    etiquetaCerrado: 'Pagada',
  },

  quote: {
    kind: 'quote',
    seccion: 'Cotizaciones',
    singular: 'cotización',
    articulo: 'la',
    nuevo: 'Nueva cotización',
    tituloDocumento: 'Cotización',
    etiquetaNumero: 'Cotización No:',
    etiquetaFecha: 'Válida hasta',
    etiquetaFechaDoc: 'Válida hasta',
    accionEmitir: 'Enviar cotización',
    verboEmitido: 'enviada',
    estadoAlEmitir: 'sent',
    accionCerrar: 'Marcar aceptada',
    estadoCerrado: 'accepted',
    etiquetaCerrado: 'Aceptada',
  },
}

export function doc(kind) {
  return DOCUMENTOS[kind] ?? DOCUMENTOS.invoice
}
