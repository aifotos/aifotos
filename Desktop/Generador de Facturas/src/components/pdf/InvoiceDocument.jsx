import { forwardRef } from 'react'
import { formatMoney, formatQty, lineTotal } from '../../lib/money.js'
import { formatDate } from '../../lib/dates.js'
import { esBorrador } from '../../db/settings.js'

/**
 * El documento que ve el cliente.
 *
 * Se usa para dos cosas: la vista previa del editor y, en la Fase 5, el
 * PDF. Por eso las medidas son de papel (A4 = 210 x 297 mm) y no de
 * pantalla: lo que ves aqui es literalmente lo que sale impreso.
 *
 * Recibe una `ref` porque la exportacion a PDF necesita el nodo del DOM
 * para rasterizarlo.
 */
const InvoiceDocument = forwardRef(function InvoiceDocument(
  { borrador, totales, emisor },
  ref,
) {
  const moneda = borrador.currency_symbol
  const numero = esBorrador(borrador.number) ? 'BORRADOR' : borrador.number
  const lineas = borrador.items.filter(
    (it) => it.description?.trim() || it.unit_price_cents > 0,
  )

  return (
    <div
      ref={ref}
      className="bg-white text-[#101318] mx-auto shadow-card"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '18mm 16mm',
        // El PDF no hereda la tipografia del sistema; se fija aqui para que
        // la vista previa y el archivo exportado se vean identicos.
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Cabecera: emisor a la izquierda, identidad de la factura a la derecha */}
      <header className="flex items-start justify-between gap-8 pb-6">
        <div className="min-w-0">
          {emisor.logo_data_url && (
            <img src={emisor.logo_data_url} alt="" className="h-12 mb-3 object-contain" />
          )}
          <p className="text-base font-semibold">
            {emisor.business_name || 'Tu negocio'}
          </p>
          <div className="mt-1 text-[11px] leading-relaxed text-[#5b6472]">
            {emisor.tax_id && <p>RNC {emisor.tax_id}</p>}
            {emisor.address && <p>{emisor.address}</p>}
            {(emisor.phone || emisor.email) && (
              <p>{[emisor.phone, emisor.email].filter(Boolean).join(' · ')}</p>
            )}
            {emisor.website && <p>{emisor.website}</p>}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[22px] font-semibold tracking-tight leading-none">FACTURA</p>
          <p className="mt-1.5 text-sm font-medium tabular-nums">{numero}</p>
          <div className="mt-3 text-[11px] leading-relaxed text-[#5b6472]">
            <p>Emitida: {formatDate(borrador.issue_date)}</p>
            {borrador.due_date && <p>Vence: {formatDate(borrador.due_date)}</p>}
          </div>
        </div>
      </header>

      {/* Cliente */}
      <section className="py-5 border-t border-[#e8eaee]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9aa3b0]">
          Facturar a
        </p>
        <p className="mt-1.5 text-sm font-semibold">
          {borrador.client.name || <span className="text-[#9aa3b0]">Sin cliente</span>}
        </p>
        <div className="mt-0.5 text-[11px] leading-relaxed text-[#5b6472]">
          {borrador.client.tax_id && <p>RNC {borrador.client.tax_id}</p>}
          {borrador.client.address && <p>{borrador.client.address}</p>}
          {(borrador.client.phone || borrador.client.email) && (
            <p>{[borrador.client.phone, borrador.client.email].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      </section>

      {/* Conceptos */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-y border-[#e8eaee]">
            <th className="py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#9aa3b0]">
              Descripción
            </th>
            <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[#9aa3b0] w-16">
              Cant.
            </th>
            <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[#9aa3b0] w-28">
              Precio
            </th>
            <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[#9aa3b0] w-28">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {lineas.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-8 text-center text-[11px] text-[#9aa3b0]">
                Aún no hay conceptos
              </td>
            </tr>
          ) : (
            lineas.map((it, i) => (
              <tr key={it.key ?? i} className="border-b border-[#f0f1f4]">
                <td className="py-2.5 pr-3 align-top">
                  {it.description}
                  {it.unit && it.unit !== 'unidad' && (
                    <span className="text-[#9aa3b0]"> / {it.unit}</span>
                  )}
                </td>
                <td className="py-2.5 text-right align-top tabular-nums">
                  {formatQty(it.quantity_milli)}
                </td>
                <td className="py-2.5 text-right align-top tabular-nums">
                  {formatMoney(it.unit_price_cents, moneda)}
                </td>
                <td className="py-2.5 text-right align-top tabular-nums">
                  {formatMoney(lineTotal(it.quantity_milli, it.unit_price_cents), moneda)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Totales */}
      <section className="mt-5 flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-[#5b6472]">Subtotal</span>
            <span className="tabular-nums">{formatMoney(totales.subtotal_cents, moneda)}</span>
          </div>
          {totales.discount_cents > 0 && (
            <div className="flex justify-between">
              <span className="text-[#5b6472]">
                Descuento
                {borrador.discount_type === 'percent' &&
                  ` (${borrador.discount_value / 100} %)`}
              </span>
              <span className="tabular-nums">
                −{formatMoney(totales.discount_cents, moneda)}
              </span>
            </div>
          )}
          <div className="flex justify-between pt-2 mt-1 border-t border-[#101318]">
            <span className="font-semibold">Total</span>
            <span className="font-semibold tabular-nums text-base">
              {formatMoney(totales.total_cents, moneda)}
            </span>
          </div>
        </div>
      </section>

      {/* Pie */}
      {(borrador.payment_details || borrador.notes) && (
        <footer className="mt-10 pt-5 border-t border-[#e8eaee] grid grid-cols-2 gap-8 text-[11px] leading-relaxed">
          {borrador.payment_details && (
            <div>
              <p className="font-semibold uppercase tracking-wider text-[10px] text-[#9aa3b0]">
                Forma de pago
              </p>
              <p className="mt-1 text-[#5b6472] whitespace-pre-line">
                {borrador.payment_details}
              </p>
            </div>
          )}
          {borrador.notes && (
            <div>
              <p className="font-semibold uppercase tracking-wider text-[10px] text-[#9aa3b0]">
                Notas
              </p>
              <p className="mt-1 text-[#5b6472] whitespace-pre-line">{borrador.notes}</p>
            </div>
          )}
        </footer>
      )}
    </div>
  )
})

export default InvoiceDocument
