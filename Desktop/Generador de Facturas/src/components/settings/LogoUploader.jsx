import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import Button from '../ui/Button.jsx'

/** Lado maximo del logo guardado, en pixeles. */
const LADO_MAXIMO = 500

/**
 * Selector del logo del negocio.
 *
 * La imagen se guarda DENTRO de la base de datos, como data URL, no como
 * una ruta a un archivo del disco. Es a proposito: una ruta se rompe en
 * cuanto mueves la carpeta o vacias la papelera, y entonces las facturas
 * viejas se imprimen sin logo sin que nadie se entere hasta que el cliente
 * las recibe. Embebida, la factura es autosuficiente.
 *
 * Antes de guardarla se reescala a 500 px de lado. Un PNG de 4000 px
 * pesaria varios megas en base64, se copiaria en cada consulta de ajustes
 * y no se veria ni un pixel mejor: en el papel el logo ocupa 22 mm, que a
 * 300 ppp son unos 260 px.
 */
export default function LogoUploader({ valor, onChange }) {
  const archivo = useRef(null)
  const [error, setError] = useState(null)

  async function elegido(e) {
    const f = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el MISMO archivo
    if (!f) return
    setError(null)
    try {
      onChange(await reescalar(f))
    } catch (err) {
      setError(String(err?.message ?? err))
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className="size-20 shrink-0 rounded-xl border border-line bg-canvas
          flex items-center justify-center overflow-hidden"
      >
        {valor ? (
          <img src={valor} alt="Logo" className="max-w-full max-h-full object-contain" />
        ) : (
          <ImagePlus className="size-6 text-ink-faint" strokeWidth={1.75} />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => archivo.current?.click()}>
            {valor ? 'Cambiar logo' : 'Subir logo'}
          </Button>
          {valor && (
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => onChange(null)}>
              Quitar
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-ink-faint">
          PNG con fondo transparente es lo que mejor queda. Se guarda dentro de la app.
        </p>
        {error && <p className="mt-1 text-xs text-overdue-ink">{error}</p>}

        <input
          ref={archivo}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={elegido}
          className="hidden"
        />
      </div>
    </div>
  )
}

/** Lee el archivo, lo encoge si hace falta y devuelve un data URL PNG. */
function reescalar(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Eso no es una imagen'))
      return
    }

    const lector = new FileReader()
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'))
    lector.onload = () => {
      const original = String(lector.result)

      // Un SVG no se rasteriza: es vectorial, ya pesa poco y encogerlo a
      // un PNG solo le quitaria nitidez al imprimirlo.
      if (file.type === 'image/svg+xml') {
        resolve(original)
        return
      }

      const img = new Image()
      img.onerror = () => reject(new Error('La imagen está dañada o no se puede abrir'))
      img.onload = () => {
        const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
        const lienzo = document.createElement('canvas')
        lienzo.width = Math.round(img.width * escala)
        lienzo.height = Math.round(img.height * escala)
        const ctx = lienzo.getContext('2d')
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
        // PNG y no JPEG: el JPEG no tiene transparencia y le pondria un
        // fondo negro a cualquier logo recortado.
        resolve(lienzo.toDataURL('image/png'))
      }
      img.src = original
    }
    lector.readAsDataURL(file)
  })
}
