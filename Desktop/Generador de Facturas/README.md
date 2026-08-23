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
npm run app:build  # Compila el .app y el .dmg para distribuir
```

El binario final queda en `src-tauri/target/release/bundle/`.

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

### Regla de oro de la estructura

El SQL vive **solo** en `src/db/`. Un componente que necesita datos llama a una
funcion de `src/db/`, nunca escribe una consulta. Asi, si algun dia la base de
datos cambia (SQLite -> Postgres/Supabase), solo se toca esa carpeta.

## Estado del desarrollo

- [x] **Fase 1** — Setup, estructura y sistema de diseno
- [ ] **Fase 2** — Esquema de base de datos (clientes, servicios, facturas)
- [ ] **Fase 3** — Dashboard y layout
- [ ] **Fase 4** — Formulario de factura y autoguardado
- [ ] **Fase 5** — Exportacion a PDF
