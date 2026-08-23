import Sidebar from './Sidebar.jsx'

/**
 * Estructura de la app: barra lateral fija + area de contenido con scroll
 * propio. El scroll vive en el contenido, no en el body, para que la barra
 * lateral y la cabecera de la seccion no se muevan.
 */
export default function AppShell({ seccion, onNavegar, onNuevaFactura, children }) {
  return (
    <div className="h-full flex overflow-hidden">
      <Sidebar actual={seccion} onNavegar={onNavegar} onNuevaFactura={onNuevaFactura} />
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  )
}
