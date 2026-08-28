-- =====================================================================
-- Cuentas separadas, impuestos y retenciones
-- =====================================================================
-- Tres cambios que van juntos porque los tres tocan las mismas tablas y
-- una migracion a medias no existe:
--
--   1. Dos negocios en la misma app (aifotos y remont). No comparten
--      NADA: ni clientes, ni catalogo, ni numeracion, ni logo, ni
--      historial. Son dos contabilidades distintas que casualmente
--      corren en el mismo Mac.
--   2. Impuestos y retenciones opcionales por documento, con un catalogo
--      propio de cada cuenta (el ITBIS de remont no le sirve a aifotos,
--      que factura sin impuestos).
--   3. Los campos del encabezado que pide el formato nuevo (lugar del
--      servicio, condiciones de credito, usuario que la preparo).
--
-- El aislamiento entre cuentas NO se confia al codigo de la app. Se hace
-- igual que se hizo con facturas y cotizaciones en la migracion 003: con
-- vistas. Hay una fila `sesion` con la cuenta activa, todas las lecturas
-- pasan por vistas que filtran por ella, y asi olvidarse del filtro deja
-- de ser posible. Una consulta despistada no puede ensenarle a remont un
-- cliente de aifotos, porque la consulta ni siquiera ve esa fila.

-- ---------------------------------------------------------------------
-- CUENTAS
-- ---------------------------------------------------------------------
CREATE TABLE accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    display_name  TEXT    NOT NULL,

    -- PBKDF2-SHA256. Vacio = la cuenta todavia no tiene contrasena y la
    -- pantalla de acceso pide crearla la primera vez.
    --
    -- No hay contrasena por defecto escrita en el codigo A PROPOSITO:
    -- este proyecto vive en un repositorio publico, y una clave en el
    -- fuente es una clave publicada. La eliges tu, en tu Mac, y solo
    -- queda su hash en la base local.
    password_hash TEXT    NOT NULL DEFAULT '',
    password_salt TEXT    NOT NULL DEFAULT '',

    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO accounts (id, username, display_name) VALUES
    (1, 'aifotos', 'aifotos'),
    (2, 'remont',  'remont');

-- ---------------------------------------------------------------------
-- SESION: una sola fila con la cuenta activa.
--
-- Es el pivote del que cuelgan todas las vistas. NULL = nadie ha entrado,
-- y entonces las vistas no devuelven ni una fila: sin sesion la app no
-- ensena datos de nadie, ni por error.
-- ---------------------------------------------------------------------
CREATE TABLE sesion (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    started_at TEXT
);

INSERT INTO sesion (id, account_id) VALUES (1, NULL);

-- ---------------------------------------------------------------------
-- AJUSTES: de fila unica a una fila por cuenta.
--
-- Cada negocio tiene su logo, su numeracion, sus datos bancarios y su
-- pie de factura. La fila que existia pasa entera a aifotos.
-- ---------------------------------------------------------------------
CREATE TABLE settings_nueva (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id          INTEGER NOT NULL UNIQUE
                        REFERENCES accounts(id) ON DELETE CASCADE,

    business_name       TEXT    NOT NULL DEFAULT '',
    tax_id              TEXT    NOT NULL DEFAULT '',
    email               TEXT    NOT NULL DEFAULT '',
    phone               TEXT    NOT NULL DEFAULT '',
    address             TEXT    NOT NULL DEFAULT '',
    website             TEXT    NOT NULL DEFAULT '',
    logo_data_url       TEXT,

    -- Color de las bandas del documento. Cada negocio con el suyo.
    accent_color        TEXT    NOT NULL DEFAULT '#F5C851',

    currency_symbol     TEXT    NOT NULL DEFAULT 'RD$',
    invoice_prefix      TEXT    NOT NULL DEFAULT 'FAC-',
    -- Digitos del correlativo: 4 -> 'FAC-0007', 5 -> '00024'.
    number_padding      INTEGER NOT NULL DEFAULT 4 CHECK (number_padding BETWEEN 1 AND 9),
    next_invoice_number INTEGER NOT NULL DEFAULT 1,
    next_draft_number   INTEGER NOT NULL DEFAULT 1,
    next_quote_number   INTEGER NOT NULL DEFAULT 1,
    payment_terms_days  INTEGER NOT NULL DEFAULT 15,

    default_notes       TEXT    NOT NULL DEFAULT '',
    payment_details     TEXT    NOT NULL DEFAULT '',
    -- Quien prepara el documento ("Usuario" en el pie del formato).
    default_user        TEXT    NOT NULL DEFAULT '',

    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO settings_nueva
    (account_id, business_name, tax_id, email, phone, address, website,
     logo_data_url, currency_symbol, invoice_prefix, next_invoice_number,
     next_draft_number, next_quote_number, payment_terms_days,
     default_notes, payment_details, updated_at)
SELECT
     1, business_name, tax_id, email, phone, address, website,
     logo_data_url, currency_symbol, invoice_prefix, next_invoice_number,
     next_draft_number, next_quote_number, payment_terms_days,
     default_notes, payment_details, updated_at
FROM settings WHERE id = 1;

-- remont arranca vacia. Sus datos (direccion, cuenta bancaria, cedula)
-- se escriben desde Ajustes, en el Mac: no se meten aqui porque este
-- archivo se publica en GitHub y esos datos son de una persona real.
-- El correlativo empieza en 25 para seguir donde iba su numeracion.
INSERT INTO settings_nueva
    (account_id, business_name, invoice_prefix, number_padding, next_invoice_number)
VALUES (2, 'remont', '', 5, 25);

DROP TABLE settings;
ALTER TABLE settings_nueva RENAME TO settings;

-- ---------------------------------------------------------------------
-- CATALOGO DE IMPUESTOS Y RETENCIONES
--
-- No son una casilla fija de "ITBIS si/no": son reglas que tu creas, con
-- su nombre y su tasa, y aplicas al documento que las necesita. Un
-- cliente residencial no lleva ninguna; una empresa que retiene el ITBIS
-- lleva tres. La factura no puede obligarte a una de las dos formas.
--
--   kind = 'tax'       SUMA al importe bruto (ITBIS 18 %)
--   kind = 'retention' RESTA del subtotal    (ITBIS retenido, ISR 2 %)
--
--   base = 'subtotal'  se calcula sobre el bruto menos el descuento
--   base = 'taxes'     se calcula sobre los impuestos ya sumados
--                      (asi se expresa "retienen el 100 % del ITBIS")
--   base = 'fixed'     importe fijo, sin porcentaje
--
-- `rate_bp` va en centesimas de punto: 1800 = 18.00 %, 10000 = 100.00 %.
-- Con base 'fixed' el mismo campo son centavos. Es el mismo truco que ya
-- usa `discount_value`, donde el tipo de descuento decide si el numero es
-- un porcentaje o un importe.
-- ---------------------------------------------------------------------
CREATE TABLE tax_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    name        TEXT    NOT NULL,
    name_key    TEXT    NOT NULL,

    kind        TEXT    NOT NULL CHECK (kind IN ('tax', 'retention')),
    base        TEXT    NOT NULL DEFAULT 'subtotal'
                CHECK (base IN ('subtotal', 'taxes', 'fixed')),
    rate_bp     INTEGER NOT NULL DEFAULT 0 CHECK (rate_bp >= 0),

    position    INTEGER NOT NULL DEFAULT 0,
    archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),

    UNIQUE (account_id, name_key)
);

CREATE INDEX idx_tax_rules_cuenta ON tax_rules (account_id, archived, position);

-- Las tres reglas del formato de remont, listas para usar. Se pueden
-- editar, archivar o ampliar desde Ajustes. aifotos no lleva ninguna:
-- factura simple, sin impuestos, como se decidio al empezar.
INSERT INTO tax_rules (account_id, name, name_key, kind, base, rate_bp, position) VALUES
    (2, 'ITBIS 18%',     'itbis 18%',     'tax',       'subtotal',  1800, 0),
    (2, 'ITBIS Ret.',    'itbis ret.',    'retention', 'taxes',    10000, 1),
    (2, 'ISR 2%',        'isr 2%',        'retention', 'subtotal',   200, 2);

-- ---------------------------------------------------------------------
-- Las vistas viejas se van: se rehacen al final filtrando por cuenta.
-- ---------------------------------------------------------------------
DROP VIEW facturas;
DROP VIEW cotizaciones;

-- ---------------------------------------------------------------------
-- CLIENTES, SERVICIOS, FACTURAS Y LINEAS: todo con dueno.
--
-- `name_key` y `number` dejan de ser unicos a secas y pasan a serlo POR
-- CUENTA. Sin eso, que remont diera de alta a un cliente que aifotos ya
-- tenia seria un error de clave duplicada, y las dos numeraciones
-- chocarian en cuanto ambas llegaran a la factura 25.
--
-- El orden de los DROP es el de siempre y no es negociable: las claves
-- ajenas estan activas durante la migracion, asi que soltar un padre
-- antes que su hijo dispara el ON DELETE y se lleva datos por delante.
-- Primero las lineas, luego las facturas, luego servicios y clientes.
-- ---------------------------------------------------------------------
CREATE TABLE clients_nueva (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    name        TEXT    NOT NULL,
    name_key    TEXT    NOT NULL,

    email       TEXT    NOT NULL DEFAULT '',
    phone       TEXT    NOT NULL DEFAULT '',
    address     TEXT    NOT NULL DEFAULT '',
    tax_id      TEXT    NOT NULL DEFAULT '',
    notes       TEXT    NOT NULL DEFAULT '',

    times_used   INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,

    archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),

    UNIQUE (account_id, name_key)
);

INSERT INTO clients_nueva
    (id, account_id, name, name_key, email, phone, address, tax_id, notes,
     times_used, last_used_at, archived, created_at, updated_at)
SELECT
     id, 1, name, name_key, email, phone, address, tax_id, notes,
     times_used, last_used_at, archived, created_at, updated_at
FROM clients;

CREATE TABLE services_nueva (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    name        TEXT    NOT NULL,
    name_key    TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',

    unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    unit        TEXT    NOT NULL DEFAULT 'unidad',

    times_used   INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,

    archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),

    UNIQUE (account_id, name_key)
);

INSERT INTO services_nueva
    (id, account_id, name, name_key, description, unit_price_cents, unit,
     times_used, last_used_at, archived, created_at, updated_at)
SELECT
     id, 1, name, name_key, description, unit_price_cents, unit,
     times_used, last_used_at, archived, created_at, updated_at
FROM services;

CREATE TABLE invoices_nueva (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    number          TEXT    NOT NULL,
    kind            TEXT    NOT NULL DEFAULT 'invoice'
                    CHECK (kind IN ('invoice', 'quote')),
    converted_to_id INTEGER REFERENCES invoices_nueva(id) ON DELETE SET NULL,

    client_id       INTEGER REFERENCES clients_nueva(id) ON DELETE SET NULL,
    client_name     TEXT    NOT NULL DEFAULT '',
    client_email    TEXT    NOT NULL DEFAULT '',
    client_phone    TEXT    NOT NULL DEFAULT '',
    client_address  TEXT    NOT NULL DEFAULT '',
    client_tax_id   TEXT    NOT NULL DEFAULT '',

    issue_date      TEXT    NOT NULL,
    due_date        TEXT,

    status          TEXT    NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'pending', 'paid', 'cancelled',
                                      'sent', 'accepted', 'rejected')),
    paid_at         TEXT,

    -- Cabecera del formato. Texto libre y opcional: en una factura de
    -- fotografia no aplica ninguno y el bloque no se imprime.
    service_place     TEXT NOT NULL DEFAULT '',  -- Lugar del servicio
    service_date_text TEXT NOT NULL DEFAULT '',  -- "15/07/2026", "Por definir"
    credit_terms      TEXT NOT NULL DEFAULT '',  -- "50% adelanto - 50% contra entrega"
    quote_ref         TEXT NOT NULL DEFAULT '',  -- cotizacion de origen
    prepared_by       TEXT NOT NULL DEFAULT '',  -- "Usuario"

    subtotal_cents  INTEGER NOT NULL DEFAULT 0,
    discount_type   TEXT    NOT NULL DEFAULT 'none'
                    CHECK (discount_type IN ('none', 'amount', 'percent')),
    discount_value  INTEGER NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
    discount_cents  INTEGER NOT NULL DEFAULT 0,

    -- Suma de los impuestos y de las retenciones ya calculados. Se
    -- guardan aparte del detalle para que el panel pueda sumar sin abrir
    -- cada documento.
    tax_cents       INTEGER NOT NULL DEFAULT 0,
    retention_cents INTEGER NOT NULL DEFAULT 0,

    -- El importe NETO: bruto - descuento + impuestos - retenciones.
    -- Es lo que se cobra, y por eso sigue llamandose total_cents: todo lo
    -- que ya sumaba dinero en la app (panel, fichas de cliente, vencidos)
    -- sigue sumando la cifra correcta sin tocar una sola consulta.
    total_cents     INTEGER NOT NULL DEFAULT 0,

    currency_symbol TEXT    NOT NULL DEFAULT 'RD$',
    notes           TEXT    NOT NULL DEFAULT '',
    payment_details TEXT    NOT NULL DEFAULT '',

    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),

    UNIQUE (account_id, number),

    CHECK (
      (kind = 'invoice' AND status IN ('draft', 'pending', 'paid', 'cancelled'))
      OR
      (kind = 'quote'   AND status IN ('draft', 'sent', 'accepted', 'rejected'))
    ),
    CHECK (converted_to_id IS NULL OR kind = 'quote')
);

INSERT INTO invoices_nueva
    (id, account_id, number, kind, converted_to_id, client_id, client_name,
     client_email, client_phone, client_address, client_tax_id, issue_date,
     due_date, status, paid_at, subtotal_cents, discount_type, discount_value,
     discount_cents, total_cents, currency_symbol, notes, payment_details,
     created_at, updated_at)
SELECT
     id, 1, number, kind, converted_to_id, client_id, client_name,
     client_email, client_phone, client_address, client_tax_id, issue_date,
     due_date, status, paid_at, subtotal_cents, discount_type, discount_value,
     discount_cents, total_cents, currency_symbol, notes, payment_details,
     created_at, updated_at
FROM invoices;

CREATE TABLE invoice_items_nueva (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id      INTEGER NOT NULL
                    REFERENCES invoices_nueva(id) ON DELETE CASCADE,
    service_id      INTEGER REFERENCES services_nueva(id) ON DELETE SET NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    description     TEXT    NOT NULL DEFAULT '',
    -- Detalle en varias lineas bajo el titulo del concepto, tal como en
    -- el formato ("Mano de obra" y debajo el desglose de lo que incluye).
    detail          TEXT    NOT NULL DEFAULT '',
    quantity_milli  INTEGER NOT NULL DEFAULT 1000 CHECK (quantity_milli > 0),
    unit            TEXT    NOT NULL DEFAULT 'unidad',
    unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    line_total_cents INTEGER NOT NULL DEFAULT 0
);

INSERT INTO invoice_items_nueva
    (id, invoice_id, service_id, position, description, quantity_milli,
     unit, unit_price_cents, line_total_cents)
SELECT
     id, invoice_id, service_id, position, description, quantity_milli,
     unit, unit_price_cents, line_total_cents
FROM invoice_items;

DROP TABLE invoice_items;
DROP TABLE invoices;
DROP TABLE services;
DROP TABLE clients;

ALTER TABLE clients_nueva       RENAME TO clients;
ALTER TABLE services_nueva      RENAME TO services;
ALTER TABLE invoices_nueva      RENAME TO invoices;
ALTER TABLE invoice_items_nueva RENAME TO invoice_items;

-- ---------------------------------------------------------------------
-- IMPUESTOS Y RETENCIONES APLICADOS A UN DOCUMENTO
--
-- Copia congelada de la regla, igual que los datos del cliente: si el
-- ano que viene el ISR pasa al 3 %, esta factura debe seguir imprimiendo
-- el 2 % con el que se emitio. Por eso guarda nombre, tipo, base y tasa,
-- y `rule_id` es solo una referencia suelta que puede quedarse en NULL.
-- ---------------------------------------------------------------------
CREATE TABLE invoice_adjustments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    rule_id      INTEGER REFERENCES tax_rules(id) ON DELETE SET NULL,

    position     INTEGER NOT NULL DEFAULT 0,
    name         TEXT    NOT NULL,
    kind         TEXT    NOT NULL CHECK (kind IN ('tax', 'retention')),
    base         TEXT    NOT NULL CHECK (base IN ('subtotal', 'taxes', 'fixed')),
    rate_bp      INTEGER NOT NULL DEFAULT 0,
    amount_cents INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_ajustes_factura ON invoice_adjustments (invoice_id, position);

-- ---------------------------------------------------------------------
-- Indices y disparadores: se fueron con las tablas viejas.
-- ---------------------------------------------------------------------
CREATE INDEX idx_clients_busqueda  ON clients  (account_id, archived, times_used DESC, name);
CREATE INDEX idx_services_busqueda ON services (account_id, archived, times_used DESC, name);
CREATE INDEX idx_invoices_listado  ON invoices (account_id, kind, issue_date DESC, id DESC);
CREATE INDEX idx_invoices_estado   ON invoices (account_id, kind, status, issue_date DESC);
CREATE INDEX idx_invoices_cliente  ON invoices (client_id, issue_date DESC);
CREATE INDEX idx_items_factura     ON invoice_items (invoice_id, position);

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

CREATE TRIGGER trg_tax_rules_updated
AFTER UPDATE ON tax_rules FOR EACH ROW
BEGIN
    UPDATE tax_rules SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- ---------------------------------------------------------------------
-- LAS VISTAS. Todo lo que la app lee pasa por aqui.
--
-- Cada una filtra por la cuenta de la sesion. Consecuencia buscada: sin
-- sesion iniciada no devuelven ninguna fila, y con la sesion de remont
-- abierta es literalmente imposible leer un dato de aifotos, aunque la
-- consulta se escriba mal.
-- ---------------------------------------------------------------------
-- Los dos tipos juntos, para abrir un documento por su id sin tener que
-- saber de antemano si es factura o cotizacion. Sigue sin cruzar cuentas.
CREATE VIEW mis_documentos AS
    SELECT * FROM invoices
     WHERE account_id = (SELECT account_id FROM sesion WHERE id = 1);

CREATE VIEW facturas AS
    SELECT * FROM invoices
     WHERE kind = 'invoice'
       AND account_id = (SELECT account_id FROM sesion WHERE id = 1);

CREATE VIEW cotizaciones AS
    SELECT * FROM invoices
     WHERE kind = 'quote'
       AND account_id = (SELECT account_id FROM sesion WHERE id = 1);

CREATE VIEW mis_clientes AS
    SELECT * FROM clients
     WHERE account_id = (SELECT account_id FROM sesion WHERE id = 1);

CREATE VIEW mis_servicios AS
    SELECT * FROM services
     WHERE account_id = (SELECT account_id FROM sesion WHERE id = 1);

CREATE VIEW mis_impuestos AS
    SELECT * FROM tax_rules
     WHERE account_id = (SELECT account_id FROM sesion WHERE id = 1);

CREATE VIEW mis_ajustes AS
    SELECT * FROM settings
     WHERE account_id = (SELECT account_id FROM sesion WHERE id = 1);
