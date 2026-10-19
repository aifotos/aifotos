-- =====================================================================
-- Costeos: de lo que te cuesta a lo que cobras
-- =====================================================================
-- Hasta ahora esto vivia en un Excel y el resultado se retecleaba en la
-- app. Lo que se trae aqui no es la hoja: es la decision que hay detras.
--
-- La formula es margen SOBRE PRECIO DE VENTA, no markup:
--
--     precio = costo / (1 - margen)
--
-- Con un costo de 2.500 y un 20 %, el precio es 3.125 y la ganancia 625,
-- que es el 20 % de 3.125. El markup (costo * 1,20 = 3.000) daria una
-- ganancia de 500, que sobre el precio es un 16,7 %: casi un cuarto menos
-- de lo que crees estar ganando. Por eso la division y no la multiplicacion.
--
-- El costeo NO se imprime nunca. Vive en sus propias tablas y la capa que
-- genera el PDF no las toca: que el cliente no vea tu costo no depende de
-- que nadie se equivoque de pantalla.

-- ---------------------------------------------------------------------
-- Ajustes nuevos, por cuenta.
--
-- Son ADD COLUMN sueltos: SQLite los aplica sin reconstruir la tabla, asi
-- que no hay riesgo de perder los ajustes que ya hay escritos.
-- ---------------------------------------------------------------------
ALTER TABLE settings ADD COLUMN next_costing_number INTEGER NOT NULL DEFAULT 1;

-- Margenes por defecto, en centesimas de punto (2000 = 20,00 %), igual
-- que el descuento y los impuestos. Son solo el valor de partida de cada
-- linea: se cambian linea a linea cuando hace falta.
ALTER TABLE settings ADD COLUMN margin_labor_bp    INTEGER NOT NULL DEFAULT 2000;
ALTER TABLE settings ADD COLUMN margin_material_bp INTEGER NOT NULL DEFAULT 2000;

-- El segundo precio. Cada costeo calcula DOS: el de empresa, con el
-- margen de la linea, y este, con su propio margen y su propio redondeo.
--
-- No es "el mismo precio redondeado", aunque asi se llamara en el Excel:
-- alli salia de dividir entre 0,7 y redondear a la centena, o sea un 30 %
-- frente al 20 % del otro. Sobre un costo de 6.700 eso son 9.600 en vez
-- de 8.380 — mil doscientos pesos de diferencia, que no es un redondeo.
-- Aqui se llama por su nombre y se configura aparte.
ALTER TABLE settings ADD COLUMN margin_secondary_bp INTEGER NOT NULL DEFAULT 3000;

-- Paso de redondeo en centavos: 1000 = al multiplo de RD$10 mas cercano,
-- 10000 = de RD$100. 0 = sin redondear.
ALTER TABLE settings ADD COLUMN rounding_primary_cents   INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE settings ADD COLUMN rounding_secondary_cents INTEGER NOT NULL DEFAULT 10000;

-- ---------------------------------------------------------------------
-- EL COSTEO
--
-- Es un documento con cabecera y lineas, no una lista de filas sueltas:
-- el Excel ya las agrupaba por numero de cotizacion y proveedor, porque
-- lo que se costea es un trabajo entero, no un material.
-- ---------------------------------------------------------------------
CREATE TABLE costings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    number      TEXT    NOT NULL,              -- 'COS-0007'
    title       TEXT    NOT NULL DEFAULT '',   -- la obra o el trabajo
    issue_date  TEXT    NOT NULL,

    client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    client_name TEXT    NOT NULL DEFAULT '',
    supplier    TEXT    NOT NULL DEFAULT '',   -- proveedor principal
    supplier_ref TEXT   NOT NULL DEFAULT '',   -- su numero de cotizacion

    -- A quien se le va a cotizar. Decide cual de los dos precios se lleva
    -- la cotizacion: a una empresa el calculado tal cual, porque revisa el
    -- numero y uno redondo parece inventado; a un residencial el redondo.
    price_mode  TEXT    NOT NULL DEFAULT 'business'
                CHECK (price_mode IN ('business', 'residential')),

    -- 'none' | 'policy' (tramos por tamano) | 'manual'
    discount_mode TEXT  NOT NULL DEFAULT 'none'
                  CHECK (discount_mode IN ('none', 'policy', 'manual')),
    discount_bp   INTEGER NOT NULL DEFAULT 0 CHECK (discount_bp >= 0 AND discount_bp <= 10000),

    -- La cotizacion que salio de aqui. Como en las cotizaciones
    -- convertidas: no se transforma ni se borra, quedan las dos enlazadas,
    -- y este campo impide ademas generarla dos veces.
    quote_id    INTEGER REFERENCES invoices(id) ON DELETE SET NULL,

    -- Totales ya calculados. Se guardan, como en las facturas, para que
    -- el listado no tenga que abrir cada costeo y recalcular sus lineas
    -- solo para ensenar una cifra.
    cost_cents     INTEGER NOT NULL DEFAULT 0,
    gross_cents    INTEGER NOT NULL DEFAULT 0,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    total_cents    INTEGER NOT NULL DEFAULT 0,

    notes       TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),

    UNIQUE (account_id, number)
);

CREATE INDEX idx_costings_listado ON costings (account_id, issue_date DESC, id DESC);

-- ---------------------------------------------------------------------
-- LAS LINEAS
--
-- `delivery_cents` va aparte del costo pero cuenta DENTRO de la base del
-- margen. En el Excel no era asi y el numero mentia: en la mampara, el
-- precio si se calculaba sobre costo + entrega (5.000 + 500) pero el
-- margen se comparaba solo contra el costo, asi que la hoja declaraba un
-- 31,8 % donde de verdad habia un 25 %. Si la entrega se paga, es costo.
-- ---------------------------------------------------------------------
CREATE TABLE costing_lines (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    costing_id  INTEGER NOT NULL REFERENCES costings(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL DEFAULT 0,

    -- Mano de obra o material: cada una arranca con su margen por defecto.
    category    TEXT    NOT NULL DEFAULT 'material'
                CHECK (category IN ('labor', 'material')),

    description TEXT    NOT NULL DEFAULT '',
    supplier    TEXT    NOT NULL DEFAULT '',
    sku         TEXT    NOT NULL DEFAULT '',   -- codigo del proveedor

    quantity_milli INTEGER NOT NULL DEFAULT 1000 CHECK (quantity_milli > 0),
    cost_cents     INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
    delivery_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_cents >= 0),

    -- Como se fija el precio de esta linea:
    --   'margin' -> costo / (1 - margin_bp)
    --   'double' -> se cobra el doble del costo. No es un margen: es un
    --               seguro. Hay materiales que se rompen al instalarlos
    --               (una mampara) y se cobran dos para poder reponer una
    --               sin discutir. Lleva su motivo al lado para que dentro
    --               de seis meses se sepa si valio la pena.
    --   'manual' -> un precio cerrado, sin cuentas.
    price_mode  TEXT    NOT NULL DEFAULT 'margin'
                CHECK (price_mode IN ('margin', 'double', 'manual')),

    -- Tope en 9999: un margen del 100 % sobre precio de venta es una
    -- division por cero, no un precio infinito.
    margin_bp   INTEGER NOT NULL DEFAULT 2000
                CHECK (margin_bp >= 0 AND margin_bp <= 9999),
    manual_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (manual_price_cents >= 0),
    double_reason      TEXT    NOT NULL DEFAULT '',

    -- Lo que costo de verdad, cuando se sabe. NULL = todavia no se sabe,
    -- que no es lo mismo que cero.
    real_cost_cents INTEGER CHECK (real_cost_cents IS NULL OR real_cost_cents >= 0),

    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_costing_lines ON costing_lines (costing_id, position);

CREATE TRIGGER trg_costings_updated
AFTER UPDATE ON costings FOR EACH ROW
BEGIN
    UPDATE costings SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_costing_lines_updated
AFTER UPDATE ON costing_lines FOR EACH ROW
BEGIN
    UPDATE costing_lines SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- Una linea no puede acabar en el costeo de otra cuenta.
CREATE TRIGGER trg_costing_line_duena
BEFORE INSERT ON costing_lines
BEGIN
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM costings WHERE id = NEW.costing_id)
    THEN RAISE(ABORT, 'El costeo no existe') END;
END;

-- ---------------------------------------------------------------------
-- La vista. Como todo lo demas, filtrada por la sesion abierta.
-- ---------------------------------------------------------------------
CREATE VIEW mis_costeos AS
    SELECT c.*, q.number AS quote_number
      FROM costings c
      LEFT JOIN invoices q ON q.id = c.quote_id
     WHERE c.account_id = (SELECT account_id FROM sesion WHERE id = 1);
