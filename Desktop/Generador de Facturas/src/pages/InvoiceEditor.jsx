import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Cloud, CloudOff, Loader2, Printer, Send } from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import Field, { inputClass, textareaClass } from '../components/ui/Field.jsx'
import ClientSection from '../components/invoice/ClientSection.jsx'
import ItemsTable from '../components/invoice/ItemsTable.jsx'
import TotalsSection from '../components/invoice/TotalsSection.jsx'
import InvoiceDocument from '../components/pdf/InvoiceDocument.jsx'
import DocumentPreview from '../components/pdf/DocumentPreview.jsx'
import PrintArea from '../components/pdf/PrintArea.jsx'
import useInvoiceDraft from '../hooks/useInvoiceDraft.js'
import usePrint from '../hooks/usePrint.js'
import { esBorrador } from '../db/settings.js'
import { addDays } from '../lib/dates.js'
import * as invoices from '../db/invoices.js'

/**
 * Editor de facturas a pantalla completa: formulario a la izquierda,
 * el documento tal cual saldra impreso a la derecha, actualizandose
 * mientras escribes.
 */
export default function InvoiceEditor({ ajustes, facturaId, onSalir }) {
  const { borrador, actualizar, guardarAhora, totales, estadoGuardado, cargando } =
    useInvoiceDraft({ ajustes, facturaId })
  const [emitiendo, setEmitiendo] = useState(false)
  const [preguntarEmitir, setPreguntarEmitir] = useState(false)
  const documento = useRef(null)
  const imprimir = usePrint()

  if (cargando || !borrador) {
    return (
      <div className="h-full flex items-center justify-center text-ink-soft">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  const sinEmitir = esBorrador(borrador.number)

  async function emitir() {
    setEmitiendo(true)
    try {
      const guardada = await guardarAhora({ ...borrador, status: 'pending' })
      if (guardada) {
        actualizar({ status: 'pending', number: guardada.number })
      }
    } finally {
      setEmitiendo(false)
    }
  }

  /**
   * Exportar un borrador manda al cliente un PDF que pone "BORRADOR" en
   * lugar de un numero de factura. Casi nunca es lo que se quiere, pero a
   * veces si (ensenar un presupuesto antes de facturar en firme), asi que
   * se pregunta en vez de decidir por el usuario.
   */
  async function exportar() {
    if (sinEmitir) {
      setPreguntarEmitir(true)
      return
    }
    await guardarAhora(borrador)
    await imprimir()
  }

  async function emitirYExportar() {
    setPreguntarEmitir(false)
    await emitir()
    await imprimir()
  }

  async function exportarComoBorrador() {
    setPreguntarEmitir(false)
    await guardarAhora(borrador)
    await imprimir()
  }

  async function marcarPagada() {
    if (!borrador.id) return
    const actualizada = await invoices.setStatus(borrador.id, 'paid')
    if (actualizada) actualizar({ status: 'paid', number: actualizada.number })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Barra superior */}
      <header
        className="shrink-0 bg-canvas/85 backdrop-blur-xl border-b border-line"
      >
        <div className="px-6 pt-11 pb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onSalir}>
              Facturas
            </Button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">
                {sinEmitir ? 'Borrador' : borrador.number}
              </p>
              <IndicadorGuardado estado={estadoGuardado} />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button icon={Printer} onClick={exportar}>
              Exportar PDF
            </Button>
            {sinEmitir ? (
              <Button variant="primary" icon={Send} onClick={emitir} disabled={emitiendo}>
                {emitiendo ? 'Emitiendo…' : 'Emitir factura'}
              </Button>
            ) : borrador.status !== 'paid' ? (
              <Button variant="primary" icon={Check} onClick={marcarPagada}>
                Marcar como pagada
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl
                bg-paid-bg text-paid-ink text-sm font-medium">
                <Check className="size-4" /> Pagada
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Copia a tamano real, invisible en pantalla: es la que se imprime */}
      <PrintArea>
        <InvoiceDocument borrador={borrador} totales={totales} emisor={ajustes} />
      </PrintArea>

      <Modal
        abierto={preguntarEmitir}
        onCerrar={() => setPreguntarEmitir(false)}
        title="Esta factura aún es un borrador"
        description="Si la exportas ahora, el PDF dirá «BORRADOR» en lugar de un número de factura. ¿Quieres emitirla primero?"
      >
        <Button onClick={exportarComoBorrador}>Exportar como borrador</Button>
        <Button variant="primary" icon={Send} onClick={emitirYExportar}>
          Emitir y exportar
        </Button>
      </Modal>

      {/* Formulario | Vista previa */}
      <div className="flex-1 min-h-0 flex">
        <div className="w-[52%] min-w-0 overflow-y-auto border-r border-line">
          <div className="px-6 py-6 space-y-7 max-w-2xl">
            <ClientSection
              client={borrador.client}
              onChange={(client) => actualizar({ client })}
            />

            <section className="grid grid-cols-2 gap-3">
              <Field label="Fecha de emisión">
                <input
                  type="date"
                  className={inputClass}
                  value={borrador.issue_date}
                  onChange={(e) =>
                    actualizar({
                      issue_date: e.target.value,
                      // La fecha de vencimiento se recalcula sola, salvo que
                      // el usuario ya la haya puesto a mano.
                      due_date: borrador.due_date
                        ? borrador.due_date
                        : addDays(e.target.value, ajustes.payment_terms_days),
                    })
                  }
                />
              </Field>
              <Field label="Vencimiento">
                <input
                  type="date"
                  className={inputClass}
                  value={borrador.due_date ?? ''}
                  onChange={(e) => actualizar({ due_date: e.target.value || null })}
                />
              </Field>
            </section>

            <ItemsTable
              items={borrador.items}
              moneda={borrador.currency_symbol}
              onChange={(items) => actualizar({ items })}
            />

            <TotalsSection
              borrador={borrador}
              totales={totales}
              moneda={borrador.currency_symbol}
              onChange={actualizar}
            />

            <section className="grid grid-cols-2 gap-3">
              <Field label="Forma de pago">
                <textarea
                  className={textareaClass}
                  value={borrador.payment_details}
                  onChange={(e) => actualizar({ payment_details: e.target.value })}
                  placeholder="Banco, cuenta, transferencia…"
                />
              </Field>
              <Field label="Notas">
                <textarea
                  className={textareaClass}
                  value={borrador.notes}
                  onChange={(e) => actualizar({ notes: e.target.value })}
                  placeholder="Gracias por confiar en nosotros."
                />
              </Field>
            </section>
          </div>
        </div>

        {/* Vista previa: el documento a escala, en su proporcion real de A4 */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-line/40">
          <div className="p-6">
            <DocumentPreview>
              <InvoiceDocument
                ref={documento}
                borrador={borrador}
                totales={totales}
                emisor={ajustes}
              />
            </DocumentPreview>
          </div>
        </div>
      </div>
    </div>
  )
}

/** "Guardando…" / "Guardado" — discreto, en la barra superior. */
function IndicadorGuardado({ estado }) {
  const contenido = {
    guardando: [Loader2, 'Guardando…', 'animate-spin'],
    guardado: [Cloud, 'Guardado', ''],
    error: [CloudOff, 'No se pudo guardar', ''],
  }[estado]

  if (!contenido) return <p className="text-xs text-ink-faint">Sin guardar</p>

  const [Icono, texto, clase] = contenido
  return (
    <p
      className={`flex items-center gap-1 text-xs ${
        estado === 'error' ? 'text-overdue-ink' : 'text-ink-faint'
      }`}
    >
      <Icono className={`size-3 ${clase}`} /> {texto}
    </p>
  )
}
