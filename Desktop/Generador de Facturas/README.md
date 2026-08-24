# FacturaPro

App de escritorio para macOS para crear, gestionar y exportar facturas en PDF.

## Stack

| Capa | Tecnologia |
|---|---|
| Interfaz | React 19 + Vite 8 |
| Estilos | Tailwind CSS v4 (tokens en `src/index.css`) |
| Iconos | lucide-react |
| Base de datos | **SQLite local** via `tauri-plugin-sql` |
| Envoltorio nativo | Tauri v2 |

La base de datos es un archivo local (`facturapro.db`) dentro de la carpeta de
datos de la app. No hay servidor, no hay cuenta, no hay internet, no se duerme.

## Comandos

```bash
npm run dev        # Solo el frontend en el navegador (rapido, para maquetar)
npm run app:dev    # La app real en una ventana nativa de macOS
npm run app:build  # Compila el .app
```

El `.app` queda en `src-tauri/target/release/bundle/macos/`.

## Estructura

```
Generador de Facturas/
├── index.html                 Punto de entrada del webview
├── vite.config.js             Vite + Tailwind + ajustes de Tauri (puerto 1420)
├── package.json
│
├── src/                       ── FRONTEND (React) ──
│   ├── main.jsx               Monta React en #root
│   ├── App.jsx                Router y estado global
│   ├── index.css              Sistema de diseno: colores, tipografia, radios
│   │
│   ├── pages/                 Pantallas completas
│   │                          Dashboard, Editor de factura, Clientes, Ajustes
│   │
│   ├── components/
│   │   ├── layout/            Barra lateral, cabecera, contenedor de la app
│   │   ├── ui/                Piezas reutilizables: Button, Input, Card, Badge
│   │   ├── dashboard/         Lista de facturas, filtros, tarjetas de resumen
│   │   ├── invoice/           Formulario: datos del cliente, lineas, totales
│   │   └── pdf/               Plantilla del documento imprimible
│   │
│   ├── db/                    ── ACCESO A DATOS ──
│   │                          Un archivo por tabla (clients, services,
│   │                          invoices). Todo el SQL vive aqui; los
│   │                          componentes nunca escriben SQL directamente.
│   │
│   ├── hooks/                 Logica de React reutilizable
│   │                          (autocompletado, autoguardado, totales)
│   │
│   ├── lib/                   Utilidades puras sin React
│   │                          (formato de moneda, fechas, numeracion)
│   │
│   └── assets/                Logos e imagenes
│
└── src-tauri/                 ── BACKEND NATIVO (Rust) ──
    ├── Cargo.toml             Dependencias de Rust y plugins de Tauri
    ├── tauri.conf.json        Ventana, icono, bundle, permisos de seguridad
    ├── capabilities/          Que puede hacer el frontend (SQL, guardar PDF)
    ├── icons/                 Icono de la app en todos los tamanos
    └── src/
        ├── main.rs            Arranque
        └── lib.rs             Registro de plugins + migraciones de la BD
```

### Regla de oro de las migraciones

`src-tauri/migrations/001_esquema_inicial.sql` **no se toca nunca mas**.
SQLite guarda un checksum de cada migracion aplicada; si el archivo cambia,
aunque solo sea un espacio, la app arranca con `migration 1 was previously
applied but has been modified` y la unica salida es borrar la base del
usuario — o sea, sus facturas. Para cambiar el esquema se agrega
`002_*.sql` y se registra en `migrations()` de `src-tauri/src/lib.rs`.

### Regla de oro de la estructura

El SQL vive **solo** en `src/db/`. Un componente que necesita datos llama a una
funcion de `src/db/`, nunca escribe una consulta. Asi, si algun dia la base de
datos cambia (SQLite -> Postgres/Supabase), solo se toca esa carpeta.

### Borradores y numeracion

Un borrador no consume numero de factura: usa una secuencia interna
(`BOR-0003`) y recibe su `FAC-0007` definitivo solo al emitirlo. Asi, tres
borradores que nunca llegas a emitir no dejan tres huecos en la numeracion
fiscal. En pantalla un borrador nunca ensena su `BOR-`, solo "Sin emitir".

El CRM y el catalogo aprenden **solo al emitir**, nunca durante el
autoguardado. El autoguardado dispara mientras escribes, asi que aprender
ahi llenaria el catalogo con texto a medias: escribir "Video promocional"
dejaria "vi", "vid", "video"... como servicios. Un borrador es una idea;
una factura emitida es un hecho.

### Arrastrar la ventana

La ventana usa `titleBarStyle: "Overlay"`: no hay barra de titulo nativa,
asi que solo se puede arrastrar por donde se marque a mano. Hacen falta
DOS cosas, y faltando cualquiera de las dos la ventana queda clavada sin
dar ningun error:

1. El permiso `core:window:allow-start-dragging` en `capabilities/`.
   **`core:default` NO lo incluye** — trae `allow-is-maximized`,
   `allow-is-resizable` y demas, pero no este. Sin el, cada arrastre se
   deniega en silencio.
2. Un elemento con `data-tauri-drag-region` justo bajo el cursor. Tauri
   solo arrastra si el clic cae sobre el elemento que lleva el atributo:
   ponerlo en un contenedor no sirve, porque cualquier hijo que lo cubra
   lo anula. Por eso existe `components/layout/DragStrip.jsx`, una franja
   propia y vacia de 40 px en la parte superior.

### Exportacion a PDF

`window.print()` **no sirve** en esta app. WKWebView lo declara como
funcion pero no hace nada: retorna en 1 ms y no dispara ni `beforeprint`
ni `afterprint`. Comprobado con una sonda. La impresion se pide al comando
`imprimir` de Rust (`src-tauri/src/lib.rs`), que llama al motor del
sistema; desde el panel de macOS se elige "PDF > Guardar como PDF" y sale
un PDF con texto real, no una captura.

Lo que se imprime NO es la vista previa del editor: esa lleva un
`transform: scale()` para caber en el panel y saldria encogida en una
esquina del folio. Se imprime una copia aparte a escala 1 que vive en
`#zona-impresion`, fuera de `#root` (ver `components/pdf/PrintArea.jsx`).

### Sobre el `.dmg`

`bundle.targets` esta en `["app"]` a proposito. Anadir `"dmg"` hace que el
build termine llamando a `bundle_dmg.sh`, que pide a Finder colocar los
iconos por AppleScript y se cuelga de forma intermitente. Para distribuir,
anade `"dmg"` puntualmente.

### Cuando algo falla

La app compilada escribe los errores en
`~/Library/Logs/com.aifotos.facturapro/FacturaPro.log`. En desarrollo salen
por la terminal: `src/lib/logging.js` reenvia ahi los errores del webview,
porque una ventana en blanco no dice nada por si sola.

## Estado del desarrollo

- [x] **Fase 1** — Setup, estructura y sistema de diseno
- [x] **Fase 2** — Esquema de base de datos y capa de acceso a datos
- [x] **Fase 3** — Dashboard, layout y pantallas de consulta
- [x] **Fase 4** — Editor de facturas, autocompletado y autoguardado
- [x] **Fase 5** — Exportacion a PDF por impresion nativa
