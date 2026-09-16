import { forwardRef } from 'react'
import { formatAmount, formatQty, lineTotal } from '../../lib/money.js'
import { formatDate } from '../../lib/dates.js'
import { esBorrador } from '../../db/settings.js'
import { doc as vocabulario } from '../../lib/documentos.js'

/**
 * El documento que ve el cliente.
 *
 * Facturas y cotizaciones usan EXACTAMENTE la misma plantilla. Solo cambian
 * tres palabras (el titulo, la etiqueta del numero y la de la segunda
 * fecha), y esas salen de `lib/documentos.js`. Que se parezcan no es un
 * detalle estetico: el cliente que recibe la cotizacion y luego la factura
 * tiene que reconocer el mismo papel, o parecen de dos empresas distintas.
 *
 * Las medidas son de papel (A4 = 210 x 297 mm), no de pantalla: lo que ves
 * aqui es literalmente lo que sale impreso.
 */

const GRIS = '#f1f1f1'
const BORDE = '#c9ccd1'
const TINTA = '#101318'

/**
 * Negro o blanco sobre el color de acento, segun cual se lea mejor.
 *
 * El acento lo elige cada negocio en Ajustes: sobre el amarillo de remont
 * hace falta texto negro y sobre un azul oscuro haria falta blanco. Fijar
 * uno de los dos dejaria la cabecera ilegible para la mitad de los colores
 * posibles.
 */
function tintaSobre(hex) {
  const c = String(hex ?? '').replace('#', '')
  if (c.length !== 6) return TINTA
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
  // Luminancia relativa (WCAG): el verde pesa mucho mas que el azul.
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.55 ? TINTA : '#ffffff'
}

const InvoiceDocument = forwardRef(function InvoiceDocument(
  { borrador, totales, emisor },
  ref,
) {
  const moneda = borrador.currency_symbol
  const v = vocabulario(borrador.kind)
  const acento = emisor.accent_color || '#F5C851'
  const sobreAcento = tintaSobre(acento)
  const numero = esBorrador(borrador.number) ? 'BORRADOR' : borrador.number

  const lineas = borrador.items.filter(
    (it) => it.description?.trim() || it.unit_price_cents > 0,
  )

  // El bloque de la izquierda solo se imprime si tiene algo que decir. En
  // una factura de fotografia no hay "lugar del servicio" ni "condiciones
  // de credito", y una rejilla de etiquetas vacias ensucia el papel.
  const cabecera = [
    ['Lugar Servicio:', borrador.service_place],
    ['Cotización:', borrador.quote_ref],
    ['Fecha Servicio:', borrador.service_date_text],
    ['Cond. Crédito:', borrador.credit_terms],
  ].filter(([, valor]) => String(valor ?? '').trim())

  const cliente = [
    borrador.client.address,
    borrador.client.tax_id && `RNC ${borrador.client.tax_id}`,
    borrador.client.phone,
    borrador.client.email,
  ].filter(Boolean)

  return (
    <div
      ref={ref}
      className="bg-white shadow-card mx-auto flex flex-col"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '14mm 13mm',
        color: TINTA,
        fontSize: '10.5px',
        lineHeight: 1.45,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
        // Tambien aqui, ademas de en la hoja de impresion: el documento
        // se renderiza dos veces (vista previa y copia imprimible) y
        // este estilo viaja con el, no con la pagina que lo contiene.
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* ---------------------------------------------- Emisor + identidad */}
      <header className="flex items-start gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {emisor.logo_data_url && (
            <img
              src={emisor.logo_data_url}
              alt=""
              className="object-contain shrink-0"
              style={{ width: '22mm', height: '22mm' }}
            />
          )}
          <div className="min-w-0">
            <p className="font-bold leading-tight" style={{ fontSize: '22px' }}>
              {emisor.business_name || 'Tu negocio'}
            </p>
            <div style={{ color: '#3d434c' }}>
              {emisor.address && <p>{emisor.address}</p>}
              {emisor.tax_id && <p>RNC {emisor.tax_id}</p>}
              {emisor.phone && <p>{emisor.phone}</p>}
              {emisor.email && <p style={{ color: '#1a63c4' }}>{emisor.email}</p>}
              {emisor.website && <p>{emisor.website}</p>}
            </div>
          </div>
        </div>

        <div style={{ width: '78mm' }} className="shrink-0">
          <p className="text-center font-light" style={{ fontSize: '26px', lineHeight: 1.1 }}>
            {v.tituloDocumento}
          </p>
          <table className="w-full mt-2" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <Identidad acento={acento} tinta={sobreAcento} etiqueta={v.etiquetaNumero}>
                <span className="font-semibold tabular-nums" style={{ fontSize: '15px' }}>
                  {numero}
                </span>
              </Identidad>
              <Identidad acento={acento} tinta={sobreAcento} etiqueta="Fecha:">
                <span className="font-semibold">{formatDate(borrador.issue_date)}</span>
              </Identidad>
              {borrador.due_date && (
                <Identidad
                  acento={acento}
                  tinta={sobreAcento}
                  etiqueta={`${v.etiquetaFecha}:`}
                >
                  {formatDate(borrador.due_date)}
                </Identidad>
              )}
            </tbody>
          </table>
        </div>
      </header>

      {/* ------------------------------------ Datos del trabajo + cliente */}
      <section className="flex items-start gap-3 mt-5">
        <div style={{ width: '82mm' }} className="shrink-0">
          {cabecera.length > 0 && (
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                {cabecera.map(([etiqueta, valor]) => (
                  <tr key={etiqueta}>
                    <td
                      className="font-bold align-middle text-center"
                      style={{
                        background: acento,
                        color: sobreAcento,
                        width: '26mm',
                        padding: '3px 5px',
                      }}
                    >
                      {etiqueta}
                    </td>
                    <td
                      className="align-middle"
                      style={{ background: GRIS, padding: '3px 7px' }}
                    >
                      {valor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="font-bold text-center"
            style={{ background: acento, color: sobreAcento, padding: '4px 8px', fontSize: '13px' }}
          >
            DATOS CLIENTE
          </p>
          <div style={{ background: GRIS, padding: '6px 9px', minHeight: '20mm' }}>
            <p className="font-bold" style={{ fontSize: '12px' }}>
              {borrador.client.name || (
                <span style={{ color: '#9aa3b0' }}>Sin cliente</span>
              )}
            </p>
            {cliente.map((linea, i) => (
              <p key={i} style={{ color: '#3d434c' }}>
                {linea}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Conceptos */}
      <section className="mt-4 flex-1 flex flex-col min-h-0">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: acento, color: sobreAcento }}>
              <Th ancho="18mm" alinear="center">Cantidad</Th>
              <Th>Descripción</Th>
              <Th ancho="30mm" alinear="right">Precio Unitario</Th>
              <Th ancho="32mm" alinear="right">Subtotal</Th>
            </tr>
          </thead>
        </table>

        {/* El recuadro crece hasta el pie: una factura de dos lineas y una
            de quince ocupan la misma hoja, con el total siempre abajo. */}
        <div
          className="flex-1"
          style={{ border: `1px solid ${BORDE}`, borderTop: 'none', minHeight: '55mm' }}
        >
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {lineas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center" style={{ padding: '14mm 0', color: '#9aa3b0' }}>
                    Aún no hay conceptos
                  </td>
                </tr>
              ) : (
                lineas.map((it, i) => (
                  <tr key={it.key ?? it.id ?? i}>
                    <td
                      className="text-center font-semibold tabular-nums align-top"
                      style={{ width: '18mm', padding: '5px 4px' }}
                    >
                      {formatQty(it.quantity_milli)}
                    </td>
                    <td className="align-top" style={{ padding: '5px 6px' }}>
                      <p className="font-bold" style={{ fontSize: '12px' }}>
                        {it.description}
                        {it.unit && it.unit !== 'unidad' && (
                          <span style={{ color: '#7b8391', fontWeight: 400 }}> / {it.unit}</span>
                        )}
                      </p>
                      {it.detail?.trim() && (
                        <p style={{ fontSize: '9.5px', color: '#3d434c', whiteSpace: 'pre-line' }}>
                          {it.detail}
                        </p>
                      )}
                    </td>
                    <td style={{ width: '30mm', padding: '5px 6px' }}>
                      <Importe moneda={moneda} cents={it.unit_price_cents} negrita />
                    </td>
                    <td style={{ width: '32mm', padding: '5px 6px' }}>
                      <Importe
                        moneda={moneda}
                        cents={lineTotal(it.quantity_milli, it.unit_price_cents)}
                        negrita
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ----------------------------------------------- Pie + liquidacion */}
      <section className="flex items-start gap-4 mt-4">
        <div className="flex-1 min-w-0" style={{ fontSize: '10px' }}>
          {borrador.notes?.trim() && (
            <>
              <p className="font-bold underline">Términos y condiciones</p>
              <p style={{ whiteSpace: 'pre-line', color: '#22262d' }}>{borrador.notes}</p>
            </>
          )}
          {borrador.payment_details?.trim() && (
            <>
              <p className="font-bold underline mt-2">Información de Pago:</p>
              <p style={{ whiteSpace: 'pre-line', fontStyle: 'italic', color: '#22262d' }}>
                {borrador.payment_details}
              </p>
            </>
          )}
          {borrador.prepared_by?.trim() && (
            <p className="mt-2">
              <span className="font-bold">Usuario:&nbsp;&nbsp;</span>
              {borrador.prepared_by}
            </p>
          )}
        </div>

        <table
          style={{ width: '78mm', borderCollapse: 'collapse', tableLayout: 'fixed' }}
          className="shrink-0"
        >
          <tbody>
            <Liquidacion acento={acento} tinta={sobreAcento} etiqueta="Importe Bruto">
              <Importe moneda={moneda} cents={totales.subtotal_cents} />
            </Liquidacion>

            <Liquidacion acento={acento} tinta={sobreAcento} etiqueta="Descuento">
              {totales.discount_cents > 0 ? (
                <Importe moneda={moneda} cents={totales.discount_cents} />
              ) : (
                <Guion moneda={moneda} />
              )}
            </Liquidacion>

            {totales.impuestos.map((a) => (
              <Liquidacion key={a.key ?? a.id ?? a.name} acento={acento} tinta={sobreAcento} etiqueta={a.name}>
                <Importe moneda={moneda} cents={a.amount_cents} />
              </Liquidacion>
            ))}

            {/* El subtotal intermedio solo aparece si hay impuestos que
                sumar: sin ellos repetiria el importe bruto. */}
            {totales.impuestos.length > 0 && (
              <Liquidacion acento={acento} tinta={sobreAcento} etiqueta="Subtotal" negrita>
                <Importe moneda={moneda} cents={totales.base_cents + totales.tax_cents} negrita />
              </Liquidacion>
            )}

            {totales.retenciones.map((a) => (
              <Liquidacion key={a.key ?? a.id ?? a.name} acento={acento} tinta={sobreAcento} etiqueta={a.name}>
                <Importe moneda={moneda} cents={a.amount_cents} />
              </Liquidacion>
            ))}

            <Liquidacion
              acento={acento}
              tinta={sobreAcento}
              etiqueta={`Importe Neto ${moneda}`}
              negrita
            >
              <Importe moneda={moneda} cents={totales.total_cents} negrita grande />
            </Liquidacion>
            {borrador.kind !== 'quote' && borrador.paid_cents > 0 && <>
              <Liquidacion acento={acento} tinta={sobreAcento} etiqueta="Pagado"><Importe moneda={moneda} cents={borrador.paid_cents} /></Liquidacion>
              <Liquidacion acento={acento} tinta={sobreAcento} etiqueta="Saldo pendiente" negrita><Importe moneda={moneda} cents={Math.max(0, totales.total_cents - borrador.paid_cents)} negrita /></Liquidacion>
            </>}
          </tbody>
        </table>
      </section>
    </div>
  )
})

/** Fila de la cajita "Factura No: / Fecha: / Vencimiento:". */
function Identidad({ acento, tinta, etiqueta, children }) {
  return (
    <tr>
      <td
        className="font-bold"
        style={{ background: acento, color: tinta, padding: '3px 7px', width: '34mm' }}
      >
        {etiqueta}
      </td>
      <td className="text-center" style={{ padding: '3px 7px' }}>
        {children}
      </td>
    </tr>
  )
}

/** Fila de la tabla de liquidacion: etiqueta con fondo de acento, importe en caja. */
function Liquidacion({ acento, tinta, etiqueta, negrita, children }) {
  return (
    <tr>
      <td
        className="font-bold text-right"
        style={{
          background: acento,
          color: tinta,
          padding: '3px 7px',
          width: '34mm',
          fontSize: negrita ? '11px' : '10.5px',
        }}
      >
        {etiqueta}
      </td>
      <td style={{ border: `1px solid ${BORDE}`, padding: '3px 7px' }}>{children}</td>
    </tr>
  )
}

function Th({ children, ancho, alinear = 'left' }) {
  return (
    <th
      className="font-bold"
      style={{ width: ancho, padding: '4px 6px', textAlign: alinear, fontSize: '12px' }}
    >
      {children}
    </th>
  )
}

/**
 * Un importe con el simbolo pegado al margen izquierdo y la cifra al
 * derecho, como en una hoja de calculo: asi las cantidades quedan
 * alineadas por el punto decimal aunque tengan distinto numero de digitos.
 */
function Importe({ moneda, cents, negrita, grande }) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      <span style={{ color: '#3d434c' }}>{moneda}</span>
      <span
        className="tabular-nums"
        style={{ fontWeight: negrita ? 700 : 400, fontSize: grande ? '14px' : undefined }}
      >
        {formatAmount(cents)}
      </span>
    </span>
  )
}

function Guion({ moneda }) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      <span style={{ color: '#3d434c' }}>{moneda}</span>
      <span style={{ color: '#7b8391' }}>-</span>
    </span>
  )
}

export default InvoiceDocument
