-- Abonos reales; los documentos conservan su importe original.
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  paid_on TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX payments_invoice ON payments(invoice_id);
INSERT INTO payments(id, invoice_id, amount_cents, paid_on, note)
SELECT 'legacy-' || id, id, total_cents, substr(COALESCE(paid_at, issue_date),1,10),
       'Saldo inicial: factura marcada pagada antes del registro de abonos'
FROM invoices WHERE kind = 'invoice' AND status = 'paid' AND total_cents > 0;

CREATE TRIGGER payment_valid BEFORE INSERT ON payments BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM invoices WHERE id = NEW.invoice_id AND kind = 'invoice'
      AND status IN ('pending','paid')
      AND account_id = (SELECT account_id FROM sesion WHERE id=1)
      AND NEW.amount_cents + COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=NEW.invoice_id),0) <= total_cents
  ) THEN RAISE(ABORT,'El abono supera el saldo o la factura no está disponible') END;
END;
CREATE TRIGGER payment_added AFTER INSERT ON payments BEGIN
  UPDATE invoices SET status = CASE WHEN (SELECT SUM(amount_cents) FROM payments WHERE invoice_id=NEW.invoice_id) >= total_cents THEN 'paid' ELSE 'pending' END,
    paid_at = CASE WHEN (SELECT SUM(amount_cents) FROM payments WHERE invoice_id=NEW.invoice_id) >= total_cents THEN NEW.paid_on ELSE NULL END
    WHERE id=NEW.invoice_id;
END;
CREATE TRIGGER payment_removed AFTER DELETE ON payments BEGIN
  UPDATE invoices SET status = CASE WHEN COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=OLD.invoice_id),0) >= total_cents THEN 'paid' ELSE 'pending' END,
    paid_at = NULL WHERE id=OLD.invoice_id AND status IN ('paid','pending');
END;
CREATE TRIGGER invoice_payment_guard BEFORE UPDATE OF total_cents, status ON invoices
WHEN NEW.kind='invoice' BEGIN
  SELECT CASE WHEN NEW.total_cents < COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=NEW.id),0)
    THEN RAISE(ABORT,'El total no puede ser menor que lo cobrado; elimina primero el abono incorrecto') END;
  SELECT CASE WHEN NEW.status IN ('draft','cancelled') AND EXISTS(SELECT 1 FROM payments WHERE invoice_id=NEW.id)
    THEN RAISE(ABORT,'La factura tiene abonos registrados') END;
END;
CREATE TRIGGER invoice_payment_status AFTER UPDATE OF total_cents, status ON invoices
WHEN NEW.kind='invoice' AND NEW.status IN ('paid','pending') AND NEW.total_cents > 0
 AND NEW.status != CASE WHEN COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=NEW.id),0)>=NEW.total_cents THEN 'paid' ELSE 'pending' END
BEGIN
 UPDATE invoices SET status=CASE WHEN COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=NEW.id),0)>=NEW.total_cents THEN 'paid' ELSE 'pending' END,
 paid_at=CASE WHEN COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=NEW.id),0)>=NEW.total_cents THEN paid_at ELSE NULL END WHERE id=NEW.id;
END;
CREATE VIEW mis_pagos AS SELECT p.* FROM payments p JOIN invoices i ON i.id=p.invoice_id
WHERE i.account_id=(SELECT account_id FROM sesion WHERE id=1);
CREATE VIEW facturas_saldos AS SELECT i.*,
 COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0) AS paid_cents
FROM facturas i;

CREATE TABLE costs (
 id INTEGER PRIMARY KEY,
 account_id INTEGER NOT NULL REFERENCES accounts(id),
 document_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
 project TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL CHECK(length(trim(description))>0),
 category TEXT NOT NULL CHECK(category IN ('cost','expense')),
 stage TEXT NOT NULL CHECK(stage IN ('planned','actual')),
 incurred_on TEXT NOT NULL,
 quantity_milli INTEGER NOT NULL CHECK(quantity_milli>0),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 supplier TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX costs_account_date ON costs(account_id, incurred_on);
CREATE TRIGGER cost_owner_insert BEFORE INSERT ON costs WHEN NEW.document_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM invoices WHERE id=NEW.document_id AND account_id=NEW.account_id)
 THEN RAISE(ABORT,'El documento pertenece a otra cuenta') END;
END;
CREATE TRIGGER cost_owner_update BEFORE UPDATE ON costs WHEN NEW.document_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM invoices WHERE id=NEW.document_id AND account_id=NEW.account_id)
 THEN RAISE(ABORT,'El documento pertenece a otra cuenta') END;
END;
CREATE VIEW mis_costos AS SELECT c.*, i.number AS document_number FROM costs c
LEFT JOIN invoices i ON i.id=c.document_id WHERE c.account_id=(SELECT account_id FROM sesion WHERE id=1);

-- Unicidad y enlace de conversion en el mismo lote que crea la factura.
CREATE TABLE quote_conversions (
 quote_id INTEGER PRIMARY KEY REFERENCES invoices(id) ON DELETE CASCADE,
 invoice_id INTEGER NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE
);
INSERT INTO quote_conversions SELECT id,converted_to_id FROM invoices WHERE kind='quote' AND converted_to_id IS NOT NULL;
CREATE TRIGGER conversion_valid BEFORE INSERT ON quote_conversions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM invoices q JOIN invoices i ON i.id=NEW.invoice_id
 WHERE q.id=NEW.quote_id AND q.kind='quote' AND q.status!='draft' AND q.converted_to_id IS NULL
 AND i.kind='invoice' AND i.account_id=q.account_id AND q.account_id=(SELECT account_id FROM sesion WHERE id=1))
 THEN RAISE(ABORT,'Esta cotización no se puede convertir') END;
END;
CREATE TRIGGER conversion_link AFTER INSERT ON quote_conversions BEGIN
 UPDATE invoices SET status='accepted', converted_to_id=NEW.invoice_id WHERE id=NEW.quote_id;
END;
