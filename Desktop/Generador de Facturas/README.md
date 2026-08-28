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

### Clientes y servicios: se crean, no se adivinan

En el editor, el cliente y cada linea se eligen de un desplegable
(`components/ui/Picker.jsx`) o se crean con un formulario que los graba en
el acto (`ClientDialog`, `ServiceDialog`).

La primera version usaba campos de texto libre que se "aprendian" al
emitir. Era comodo de escribir y malo de usar: no sabias si el cliente
habia quedado guardado, y cualquier texto a medio teclear podia acabar en
el catalogo. `aprender()` sigue existiendo —es idempotente y mantiene
`times_used` al dia— pero ya no es la via principal por la que entran los
datos.

### Transacciones: `atomico`, nunca BEGIN desde JS

**La API JS de tauri-plugin-sql NO permite transacciones.** Abre un pool de
hasta 10 conexiones y reparte cada `execute` por la que tenga libre, asi
que un `BEGIN` se queda en una conexion, los INSERT van por otras y el
`COMMIT` por una cuarta: no agrupa nada, y el ROLLBACK falla con
"cannot rollback - no transaction is active".

Costo real cuando esto estaba mal: facturas con su total en la cabecera y
CERO lineas, y un documento nuevo por cada autoguardado — diez en tres
minutos.

Para escribir varias sentencias juntas se usa `atomico([{sql, params}])`
de `src/db/index.js`, que las manda al comando `ejecutar_atomico` de Rust.
Ese comando coge el MISMO pool del plugin y pide una unica conexion con
`pool.begin()`.

Dentro de un lote no se puede leer el id que acaba de generar un INSERT,
asi que las lineas se enganchan a su factura por `number`, que es UNIQUE.

Ojo con el modo navegador: sql.js es UNA conexion en memoria, donde
BEGIN/COMMIT si funcionan. Tapo este fallo durante todo el desarrollo.
**Un fallo de concurrencia o de transacciones hay que probarlo en la app
compilada, no en `npm run dev`.**

### Facturas y cotizaciones

Son el mismo documento en la misma tabla, separados por la columna `kind`.
Comparten editor, PDF, autoguardado y catalogo; lo unico que cambia es el
vocabulario (`src/lib/documentos.js`) y el ciclo de vida.

**Toda lectura pasa por una vista, nunca por la tabla `invoices`:**

```sql
CREATE VIEW facturas     AS SELECT * FROM invoices WHERE kind = 'invoice';
CREATE VIEW cotizaciones AS SELECT * FROM invoices WHERE kind = 'quote';
```

Ese es el punto entero del diseno. Con una sola tabla, cada consulta
tendria que acordarse de filtrar por `kind`, y olvidarse una vez significa
que el panel da por cobrable un presupuesto que nadie acepto. Con las
vistas no queda ni un camino de lectura sin filtrar: **olvidarse deja de
ser posible**. La unica excepcion deliberada es `recomputarUso()`, que
cuenta los dos tipos porque para ordenar el autocompletado importa con
quien trabajas, no si el papel era fiscal.

Diferencias que no son cosmeticas:

| | Factura | Cotizacion |
|---|---|---|
| Numeracion | `FAC-` (fiscal) | `COT-` (secuencia aparte) |
| Estados | draft, pending, paid, cancelled | draft, sent, accepted, rejected |
| `due_date` | fecha limite de pago | valida hasta |
| Fecha pasada | **Vencida** — te deben dinero | **Caducada** — solo expiro |
| Cuenta como dinero | si | nunca |

Un CHECK en la base rechaza los estados cruzados: una factura no puede
estar "aceptada" ni una cotizacion "pagada".

"Caducada" y "Convertida" no se guardan como estado: la primera se deduce
de `due_date` y la segunda de `converted_to_id`. Un estado que se puede
calcular no debe almacenarse, o acaba contradiciendo a los datos de los
que salio.

Al convertir, la cotizacion **no se transforma ni se borra**: se queda
marcada como aceptada y enlazada a la factura que salio de ella
(`converted_to_id`), que ademas es el seguro que impide convertirla dos
veces.

Que hereda la factura de la cotizacion y que no:

| | |
|---|---|
| Cliente y lineas | se heredan |
| Descuento y moneda | se heredan |
| Datos de pago | se heredan — dicen como cobrarte, y si los cambiaste para ese cliente esa decision debe sobrevivir |
| Vencimiento | **no** — usa tu plazo de pago desde hoy. La validez de la cotizacion suele estar agotada cuando el cliente acepta |
| Notas | **no** — son de la oferta ("precios validos por 30 dias"). En una factura sobran, y el cliente puede leerlas como una condicion de pago. Arranca con el pie por defecto de Ajustes |

### Dos negocios, una app: el aislamiento es de esquema

La app lleva dos contabilidades separadas (`aifotos` y `remont`). No
comparten nada: ni clientes, ni catalogo, ni numeracion, ni logo, ni
impuestos, ni historial.

Lo importante es **como** se separan. No con `WHERE account_id = …`
repartidos por el codigo, sino con una fila `sesion` que guarda la cuenta
activa y unas vistas que filtran por ella:

```sql
CREATE VIEW facturas AS
    SELECT * FROM invoices
     WHERE kind = 'invoice'
       AND account_id = (SELECT account_id FROM sesion WHERE id = 1);
```

Toda lectura pasa por una de esas vistas — `facturas`, `cotizaciones`,
`mis_documentos`, `mis_clientes`, `mis_servicios`, `mis_impuestos`,
`mis_ajustes` — y nunca por la tabla cruda. Es la misma idea que separo
facturas de cotizaciones en la migracion 003, extendida a las cuentas:
**olvidarse del filtro deja de ser posible**, porque la consulta ni
siquiera alcanza las filas del otro negocio. Sin sesion iniciada las
vistas devuelven cero filas, asi que la app no puede ensenar datos de
nadie ni por error.

Las ESCRITURAS si tienen que decir de quien es la fila que crean:
`cuentaActual()` en `src/db/index.js`. Si anades una tabla con datos de
usuario, necesita `account_id` y su vista; si no, sera la unica que se vea
desde las dos cuentas.

La sesion **se cierra al arrancar** (`App.jsx` llama a
`auth.limpiarSesion()`). Es deliberado: el sentido de tener dos negocios
separados es no emitir por error desde el equivocado, y para eso hay que
elegir a proposito cada vez que abres el programa.

### Contrasenas

PBKDF2-SHA256, 210.000 iteraciones, sal aleatoria por cuenta
(`src/db/auth.js`). Comprobado dentro de WKWebView: `crypto.subtle` existe
y una derivacion cuesta ~30 ms.

**Ninguna cuenta trae contrasena de fabrica, y no es un olvido.** Este
proyecto vive dentro de `github.com/aifotos/aifotos`, que es un repositorio
**publico**: una contrasena escrita en el codigo estaria publicada el mismo
dia. La primera vez que entras en una cuenta, la pantalla de acceso te pide
crearla, y de ahi solo sale su hash a la base local.

Por la misma razon las migraciones no traen los datos reales de ningun
negocio (direccion, cuenta bancaria, cedula). Eso se escribe en Ajustes,
en el Mac.

### Impuestos y retenciones

Un impuesto SUMA y una retencion RESTA. No son una casilla fija de "cobrar
ITBIS si/no": son reglas del catalogo de cada cuenta (`tax_rules`) que se
aplican **documento a documento**. Un cliente residencial no lleva ninguna
y una empresa que retiene lleva tres, con las mismas reglas.

Cada regla dice sobre que se calcula:

| `base` | Se calcula sobre | Para que |
| --- | --- | --- |
| `subtotal` | el bruto menos el descuento | ITBIS 18 %, ISR 2 % |
| `taxes` | los impuestos ya sumados | "me retienen el 100 % del ITBIS" |
| `fixed` | nada: `rate_bp` son centavos | una retencion de importe fijo |

El orden del calculo no es un detalle (`documentTotals` en
`src/lib/money.js`): primero los impuestos, porque las retenciones pueden
apoyarse en ellos y no al reves. Sale exactamente el pie de la factura:

```
  Importe bruto      suma de las lineas
− Descuento
= Base imponible
+ Impuestos          ITBIS 18 %…
= Subtotal
− Retenciones        ITBIS retenido, ISR 2 %…
= Importe neto       lo que el cliente paga
```

Lo que se guarda en `invoice_adjustments` es una **copia congelada** de la
regla con su importe ya calculado, no un puntero. Si manana el ISR pasa al
3 %, las facturas del ano pasado siguen imprimiendo el 2 % con el que se
emitieron, que es lo que el cliente pago. Misma decision que congelar los
datos del cliente en la factura.

`total_cents` sigue significando **lo que se cobra** — ahora bruto −
descuento + impuestos − retenciones. Por eso el panel, las fichas de
cliente y los vencidos siguieron sumando la cifra correcta sin tocar una
sola consulta.

### El documento

Facturas y cotizaciones usan la MISMA plantilla
(`components/pdf/InvoiceDocument.jsx`). Solo cambian tres palabras (el
titulo, la etiqueta del numero y la de la segunda fecha), y salen de
`lib/documentos.js`. No es estetica: el cliente que recibe primero la
cotizacion y despues la factura tiene que reconocer el mismo papel.

El color de las bandas (`accent_color`) es de cada cuenta. El texto que va
encima se calcula por luminancia: negro sobre el amarillo, blanco sobre un
azul oscuro. Fijar uno de los dos dejaria la cabecera ilegible para la
mitad de los colores posibles.

Los bloques del encabezado (lugar del servicio, condiciones de credito…)
solo se imprimen si tienen contenido: en una factura de fotografia estan
vacios y una rejilla de etiquetas en blanco ensucia el papel.

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
- [x] Cotizaciones convertibles en factura
- [x] Cuentas separadas con acceso por contrasena
- [x] Impuestos y retenciones creables por cuenta
- [x] Logo del negocio y formato de documento comun
