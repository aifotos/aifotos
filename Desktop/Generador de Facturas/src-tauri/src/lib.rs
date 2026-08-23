use tauri_plugin_sql::{Migration, MigrationKind};

/// Esquema inicial: emisor, clientes, catalogo de servicios y facturas.
///
/// Convenciones:
///   * El dinero se guarda en CENTAVOS como INTEGER, nunca como decimal.
///     1,500.00 se guarda como 150000. Esto evita los errores de redondeo
///     del punto flotante (0.1 + 0.2 != 0.3), que en una factura son
///     inaceptables. La conversion vive en `src/lib/money.js`.
///   * Las fechas son TEXT en formato ISO 'YYYY-MM-DD' y las marcas de
///     tiempo en 'YYYY-MM-DD HH:MM:SS' (UTC). SQLite los ordena y compara
///     correctamente como texto.
///   * Nada se borra de verdad: se marca `archived = 1`. Una factura vieja
///     debe poder seguir mostrando a su cliente aunque ya no trabajes con el.
const V1_ESQUEMA_INICIAL: &str = r#"

-- =====================================================================
-- AJUSTES DEL EMISOR  (una sola fila, siempre id = 1)
-- =====================================================================
CREATE TABLE settings (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),

    business_name       TEXT    NOT NULL DEFAULT '',
    tax_id              TEXT    NOT NULL DEFAULT '',   -- RNC / cedula
    email               TEXT    NOT NULL DEFAULT '',
    phone               TEXT    NOT NULL DEFAULT '',
    address             TEXT    NOT NULL DEFAULT '',
    website             TEXT    NOT NULL DEFAULT '',
    logo_data_url       TEXT,                          -- imagen embebida (base64)

    currency_symbol     TEXT    NOT NULL DEFAULT 'RD$',
    invoice_prefix      TEXT    NOT NULL DEFAULT 'FAC-',
    next_invoice_number INTEGER NOT NULL DEFAULT 1,
    payment_terms_days  INTEGER NOT NULL DEFAULT 15,   -- vencimiento por defecto

    default_notes       TEXT    NOT NULL DEFAULT '',   -- pie de la factura
    payment_details     TEXT    NOT NULL DEFAULT '',   -- cuenta bancaria, etc.

    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO settings (id) VALUES (1);

-- =====================================================================
-- CLIENTES  (se crean solos al escribirlos en una factura)
-- =====================================================================
CREATE TABLE clients (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,

    name        TEXT    NOT NULL,
    -- Clave de deduplicacion: nombre normalizado (minusculas, sin espacios
    -- sobrantes). Evita que "Juan Perez" y "juan  perez" sean dos clientes.
    name_key    TEXT    NOT NULL UNIQUE,

    email       TEXT    NOT NULL DEFAULT '',
    phone       TEXT    NOT NULL DEFAULT '',
    address     TEXT    NOT NULL DEFAULT '',
    tax_id      TEXT    NOT NULL DEFAULT '',
    notes       TEXT    NOT NULL DEFAULT '',

    times_used  INTEGER NOT NULL DEFAULT 0,  -- ordena el autocompletado
    last_used_at TEXT,

    archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_clients_busqueda ON clients (archived, times_used DESC, name);

-- =====================================================================
-- CATALOGO DE SERVICIOS  (tambien se autoalimenta desde las facturas)
-- =====================================================================
CREATE TABLE services (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,

    name            TEXT    NOT NULL,
    name_key        TEXT    NOT NULL UNIQUE,
    description     TEXT    NOT NULL DEFAULT '',

    unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    unit            TEXT    NOT NULL DEFAULT 'unidad',  -- hora, dia, proyecto...

    times_used      INTEGER NOT NULL DEFAULT 0,
    last_used_at    TEXT,

    archived        INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_services_busqueda ON services (archived, times_used DESC, name);

-- =====================================================================
-- FACTURAS
-- =====================================================================
CREATE TABLE invoices (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    number          TEXT    NOT NULL UNIQUE,   -- 'FAC-0007'

    client_id       INTEGER REFERENCES clients(id) ON DELETE SET NULL,

    -- Copia congelada de los datos del cliente en el momento de emitir.
    -- Si el cliente cambia de direccion el ano que viene, esta factura
    -- debe seguir imprimiendo la direccion que tenia cuando se emitio.
    client_name     TEXT    NOT NULL DEFAULT '',
    client_email    TEXT    NOT NULL DEFAULT '',
    client_phone    TEXT    NOT NULL DEFAULT '',
    client_address  TEXT    NOT NULL DEFAULT '',
    client_tax_id   TEXT    NOT NULL DEFAULT '',

    issue_date      TEXT    NOT NULL,          -- 'YYYY-MM-DD'
    due_date        TEXT,

    status          TEXT    NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'pending', 'paid', 'cancelled')),
    paid_at         TEXT,

    subtotal_cents  INTEGER NOT NULL DEFAULT 0,
    discount_type   TEXT    NOT NULL DEFAULT 'none'
                    CHECK (discount_type IN ('none', 'amount', 'percent')),
    -- Si es 'amount' son centavos; si es 'percent' son centesimas de punto
    -- (1000 = 10.00 %). Entero en ambos casos, sin decimales flotantes.
    discount_value  INTEGER NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
    discount_cents  INTEGER NOT NULL DEFAULT 0,  -- descuento ya calculado
    total_cents     INTEGER NOT NULL DEFAULT 0,

    currency_symbol TEXT    NOT NULL DEFAULT 'RD$',
    notes           TEXT    NOT NULL DEFAULT '',
    payment_details TEXT    NOT NULL DEFAULT '',

    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_invoices_listado ON invoices (issue_date DESC, id DESC);
CREATE INDEX idx_invoices_estado  ON invoices (status, issue_date DESC);
CREATE INDEX idx_invoices_cliente ON invoices (client_id, issue_date DESC);

-- =====================================================================
-- LINEAS DE LA FACTURA
-- =====================================================================
CREATE TABLE invoice_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,

    invoice_id      INTEGER NOT NULL
                    REFERENCES invoices(id) ON DELETE CASCADE,
    -- Referencia suelta al catalogo: si borras el servicio, la linea
    -- de la factura sobrevive con su descripcion y precio propios.
    service_id      INTEGER REFERENCES services(id) ON DELETE SET NULL,

    position        INTEGER NOT NULL DEFAULT 0,      -- orden en la tabla

    description     TEXT    NOT NULL DEFAULT '',
    -- Cantidad en MILESIMAS para admitir decimales sin flotantes:
    -- 2.5 horas se guarda como 2500.
    quantity_milli  INTEGER NOT NULL DEFAULT 1000 CHECK (quantity_milli > 0),
    unit            TEXT    NOT NULL DEFAULT 'unidad',
    unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    line_total_cents INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_items_factura ON invoice_items (invoice_id, position);

-- =====================================================================
-- DISPARADORES: mantener updated_at al dia sin tener que recordarlo
-- =====================================================================
CREATE TRIGGER trg_clients_updated
AFTER UPDATE ON clients FOR EACH ROW
BEGIN
    UPDATE clients SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_services_updated
AFTER UPDATE ON services FOR EACH ROW
BEGIN
    UPDATE services SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_invoices_updated
AFTER UPDATE ON invoices FOR EACH ROW
BEGIN
    UPDATE invoices SET updated_at = datetime('now') WHERE id = OLD.id;
END;
"#;

/// Migraciones de la base de datos local (SQLite).
/// Cada migracion se ejecuta una sola vez y queda registrada por su `version`.
/// Para cambiar el esquema NUNCA se edita una migracion ya publicada:
/// se agrega una nueva con la version siguiente.
fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "esquema inicial: settings, clients, services, invoices, invoice_items",
        sql: V1_ESQUEMA_INICIAL,
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:facturapro.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
