import { useState, useMemo } from 'react'
import { Download, RotateCcw, Eye, EyeOff } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

import Header from './components/Header'
import DatosEmisor from './components/DatosEmisor'
import DatosCliente from './components/DatosCliente'
import TablaArticulos from './components/TablaArticulos'
import Totales from './components/Totales'
import Previsualizacion from './components/Previsualizacion'

const estadoInicial = {
  emisor: { nombre: '', rnc: '', direccion: '', telefono: '', email: '' },
  cliente: { nombre: '', rnc: '', direccion: '', comprobante: '', fecha: new Date().toISOString().split('T')[0] },
  articulos: [{ descripcion: '', cantidad: '', precio: '', total: '0.00' }],
  tasaItbis: 18,
}

export default function App() {
  const [modo, setModo] = useState('cotizacion')
  const [emisor, setEmisor] = useState(estadoInicial.emisor)
  const [cliente, setCliente] = useState(estadoInicial.cliente)
  const [articulos, setArticulos] = useState(estadoInicial.articulos)
  const [tasaItbis, setTasaItbis] = useState(estadoInicial.tasaItbis)
  const [mostrarPreview, setMostrarPreview] = useState(true)
  const [exportando, setExportando] = useState(false)

  const subtotal = useMemo(
    () => articulos.reduce((acc, a) => acc + parseFloat(a.total || 0), 0),
    [articulos]
  )
  const itbis = useMemo(() => subtotal * (tasaItbis / 100), [subtotal, tasaItbis])
  const total = useMemo(() => subtotal + itbis, [subtotal, itbis])

  const limpiar = () => {
    setEmisor(estadoInicial.emisor)
    setCliente({ ...estadoInicial.cliente, fecha: new Date().toISOString().split('T')[0] })
    setArticulos(estadoInicial.articulos)
    setTasaItbis(estadoInicial.tasaItbis)
  }

  const exportarPDF = async () => {
    setExportando(true)
    try {
      const elemento = document.getElementById('documento-pdf')
      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width

      let heightLeft = pdfHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
      heightLeft -= pdf.internal.pageSize.getHeight()

      while (heightLeft > 0) {
        position -= pdf.internal.pageSize.getHeight()
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
        heightLeft -= pdf.internal.pageSize.getHeight()
      }

      const nombre = `${modo === 'cotizacion' ? 'Cotizacion' : 'Factura'}_${cliente.comprobante || 'sin-numero'}_${cliente.nombre || 'cliente'}.pdf`
      pdf.save(nombre)
    } catch (err) {
      console.error('Error al exportar PDF:', err)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header modo={modo} setModo={setModo} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Barra de acciones */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Nueva {modo === 'cotizacion' ? 'Cotización' : 'Factura'}
            </h2>
            <p className="text-sm text-slate-500">Completa los datos y exporta tu documento</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMostrarPreview(!mostrarPreview)}
              className="flex items-center gap-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {mostrarPreview ? <EyeOff size={15} /> : <Eye size={15} />}
              {mostrarPreview ? 'Ocultar' : 'Ver'} preview
            </button>
            <button
              onClick={limpiar}
              className="flex items-center gap-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <RotateCcw size={15} />
              Limpiar
            </button>
            <button
              onClick={exportarPDF}
              disabled={exportando}
              className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors text-white ${
                modo === 'cotizacion'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <Download size={15} />
              {exportando ? 'Generando...' : 'Descargar PDF'}
            </button>
          </div>
        </div>

        <div className={`grid gap-6 ${mostrarPreview ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 max-w-3xl'}`}>
          {/* Panel izquierdo: formulario */}
          <div className="space-y-4">
            <DatosEmisor emisor={emisor} setEmisor={setEmisor} />
            <DatosCliente cliente={cliente} setCliente={setCliente} modo={modo} />
            <TablaArticulos articulos={articulos} setArticulos={setArticulos} />
            <Totales
              subtotal={subtotal}
              itbis={itbis}
              total={total}
              tasaItbis={tasaItbis}
              setTasaItbis={setTasaItbis}
            />
          </div>

          {/* Panel derecho: previsualización */}
          {mostrarPreview && (
            <div className="xl:sticky xl:top-6 xl:self-start">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-2">
                <p className="text-xs text-slate-500 text-center font-medium uppercase tracking-wide">
                  Previsualización del documento
                </p>
              </div>
              <div className="overflow-auto rounded-xl border border-slate-200 shadow-sm bg-gray-200 p-4">
                <div style={{ transform: 'scale(0.65)', transformOrigin: 'top center', width: '154%', marginLeft: '-27%' }}>
                  <Previsualizacion
                    modo={modo}
                    emisor={emisor}
                    cliente={cliente}
                    articulos={articulos}
                    subtotal={subtotal}
                    itbis={itbis}
                    total={total}
                    tasaItbis={tasaItbis}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
