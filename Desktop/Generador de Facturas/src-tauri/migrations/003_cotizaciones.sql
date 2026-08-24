-- =====================================================================
-- Cotizaciones
-- =====================================================================
-- Una cotizacion y una factura son el mismo documento con distinto peso:
-- mismo cliente, mismas lineas, mismos totales, mismo PDF. Lo que cambia
-- es su ciclo de vida y, sobre todo, que una cotizacion NO es dinero.
--
-- Por eso viven en la misma tabla, distinguidas por `kind`, pero se leen
-- SIEMPRE a traves de dos vistas. Ese es el punto importante de esta
-- migracion: con las vistas, olvidarse de filtrar deja de ser posible.
-- Sin ellas bastaria una consulta despistada para que el panel diera por
-- cobrable un presupuesto que nadie ha aceptado.
--
-- `due_date` se reutiliza a proposito: en una factura es la fecha limite
-- de pago y en una cotizacion la de validez. En los dos casos es "la
-- fecha a partir de la cual el documento deja de estar vigente", asi que
-- es el mismo dato con distinta etiqueta, no dos cosas metidas a la
-- fuerza en un sitio.

-- ---------------------------------------------------------------------
-- Numeracion propia. Una cotizacion no puede gastar correlativo fiscal.
-- ---------------------------------------------------------------------
ALTER TABLE settings ADD COLUMN next_quote_number INTEGER NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------
-- Reconstruccion de `invoices` para ampliar el CHECK de `status`.
--
-- SQLite no sabe modificar una restriccion CHECK: hay que rehacer la
-- tabla. El orden importa mucho, porque `invoice_items` apunta a
-- `invoices` con ON DELETE CASCADE y las migraciones corren con las
-- claves ajenas ACTIVAS: soltar `invoices` mientras algo la referencia
-- dispararia el cascade y se llevaria por delante las lineas de todas
-- las facturas. Por eso el hijo se rehace y se suelta ANTES que el padre.
-- ---------------------------------------------------------------------

CREATE TABLE invoices_nueva (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    number          TEXT    NOT NULL UNIQUE,   -- 'FAC-0007' | 'COT-0003'

    -- 'invoice' = factura, 'quote' = cotizacion.
    kind            TEXT    NOT NULL DEFAULT 'invoice'
                    CHECK (kind IN ('invoice', 'quote')),

    -- Cotizacion aceptada -> apunta a la factura que salio de ella.
    -- No se borra ni se transforma: quedan las dos, enlazadas, y este
    -- campo es ademas el seguro que impide convertirla dos veces.
    converted_to_id INTEGER REFERENCES invoices_nueva(id) ON DELETE SET NULL,

    client_id       INTEGER REFERENCES clients(id) ON DELETE SET NULL,

    client_name     TEXT    NOT NULL DEFAULT '',
    client_email    TEXT    NOT NULL DEFAULT '',
    client_phone    TEXT    NOT NULL DEFAULT '',
    client_address  TEXT    NOT NULL DEFAULT '',
    client_tax_id   TEXT    NOT NULL DEFAULT '',

    issue_date      TEXT    NOT NULL,
    -- Factura: fecha limite de pago. Cotizacion: valida hasta.
    due_date        TEXT,

    -- Facturas: draft, pending, paid, cancelled
    -- Cotizaciones: draft, sent, accepted, rejected
    -- "Caducada" y "Convertida" NO se guardan: la primera se deduce de
    -- `due_date` y la segunda de `converted_to_id`. Un estado que se
    -- puede calcular no debe almacenarse, o acaba contradiciendo a los
    -- datos de los que salio.
    status          TEXT    NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'pending', 'paid', 'cancelled',
                                      'sent', 'accepted', 'rejected')),
    paid_at         TEXT,

    subtotal_cents  INTEGER NOT NULL DEFAULT 0,
    discount_type   TEXT    NOT NULL DEFAULT 'none'
                    CHECK (discount_type IN ('none', 'amount', 'percent')),
    discount_value  INTEGER NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
    discount_cents  INTEGER NOT NULL DEFAULT 0,
    total_cents     INTEGER NOT NULL DEFAULT 0,

    currency_symbol TEXT    NOT NULL DEFAULT 'RD$',
    notes           TEXT    NOT NULL DEFAULT '',
    payment_details TEXT    NOT NULL DEFAULT '',

    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),

    -- Un estado de cotizacion en una factura (o al reves) es un dato
    -- incoherente. La base lo rechaza en vez de confiar en la app.
    CHECK (
      (kind = 'invoice' AND status IN ('draft', 'pending', 'paid', 'cancelled'))
      OR
      (kind = 'quote'   AND status IN ('draft', 'sent', 'accepted', 'rejected'))
    ),
    -- Solo una cotizacion puede haberse convertido en algo.
    CHECK (converted_to_id IS NULL OR kind = 'quote')
);

INSERT INTO invoices_nueva
    (id, number, kind, converted_to_id, client_id, client_name, client_email,
     client_phone, client_address, client_tax_id, issue_date, due_date, status,
     paid_at, subtotal_cents, discount_type, discount_value, discount_cents,
     total_cents, currency_symbol, notes, payment_details, created_at, updated_at)
SELECT
     id, number, 'invoice', NULL, client_id, client_name, client_email,
     client_phone, client_address, client_tax_id, issue_date, due_date, status,
     paid_at, subtotal_cents, discount_type, discount_value, discount_cents,
     total_cents, currency_symbol, notes, payment_details, created_at, updated_at
FROM invoices;

CREATE TABLE invoice_items_nueva (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id      INTEGER NOT NULL
                    REFERENCES invoices_nueva(id) ON DELETE CASCADE,
    service_id      INTEGER REFERENCES services(id) ON DELETE SET NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    description     TEXT    NOT NULL DEFAULT '',
    quantity_milli  INTEGER NOT NULL DEFAULT 1000 CHECK (quantity_milli > 0),
    unit            TEXT    NOT NULL DEFAULT 'unidad',
    unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    line_total_cents INTEGER NOT NULL DEFAULT 0
);

INSERT INTO invoice_items_nueva
SELECT id, invoice_id, service_id, position, description,
       quantity_milli, unit, unit_price_cents, line_total_cents
FROM invoice_items;

-- Primero el hijo (soltarlo no dispara ningun cascade),
DROP TABLE invoice_items;
-- y solo entonces el padre, cuando ya nadie lo referencia.
DROP TABLE invoices;

-- Al renombrar, SQLite reescribe la clave ajena de invoice_items_nueva
-- para que apunte a `invoices`.
ALTER TABLE invoices_nueva RENAME TO invoices;
ALTER TABLE invoice_items_nueva RENAME TO invoice_items;

-- Los indices y disparadores se fueron con las tablas viejas.
CREATE INDEX idx_invoices_listado ON invoices (kind, issue_date DESC, id DESC);
CREATE INDEX idx_invoices_estado  ON invoices (kind, status, issue_date DESC);
CREATE INDEX idx_invoices_cliente ON invoices (client_id, issue_date DESC);
CREATE INDEX idx_items_factura    ON invoice_items (invoice_id, position);

CREATE TRIGGER trg_invoices_updated
AFTER UPDATE ON invoices FOR EACH ROW
BEGIN
    UPDATE invoices SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- ---------------------------------------------------------------------
-- Las vistas. Aqui esta el valor real de esta migracion.
-- Toda lectura pasa por una de las dos, nunca por `invoices` a pelo, de
-- modo que ninguna consulta puede mezclar facturas con presupuestos.
-- Las escrituras siguen yendo a la tabla.
-- ---------------------------------------------------------------------
CREATE VIEW facturas     AS SELECT * FROM invoices WHERE kind = 'invoice';
CREATE VIEW cotizaciones AS SELECT * FROM invoices WHERE kind = 'quote';
