/**
 * Datos de ejemplo para maquetar en el navegador (`npm run dev`).
 * NUNCA se cargan en la app nativa: solo los usa src/db/browser.js.
 *
 * Sirven para ver como se comporta la interfaz con contenido real:
 * nombres largos, facturas vencidas, borradores, montos de cuatro cifras.
 */
export const datosDeEjemplo = `

UPDATE settings SET
  business_name   = 'AIFotos',
  tax_id          = '131-12345-6',
  email           = 'ejemplo@ejemplo.com',
  phone           = '(809) 555-0134',
  address         = 'Santo Domingo, República Dominicana',
  accent_color    = '#3B74F5',
  default_notes   = 'Gracias por confiar en nosotros.',
  payment_details = 'Banco de ejemplo · Cuenta 000-000000-0',
  default_user    = 'Argenis'
WHERE account_id = 1;

-- La segunda cuenta, para ver el formato con impuestos y comprobar de un
-- vistazo que los datos de una no se cuelan en la otra.
UPDATE settings SET
  business_name   = 'Remont',
  address         = 'Calle de ejemplo #34, Santiago',
  phone           = '809-000-0000',
  email           = 'ejemplo@ejemplo.do',
  accent_color    = '#F5C851',
  default_notes   = 'Las cancelaciones deben notificarse con un mínimo de 24 horas de anticipación.',
  payment_details = 'Banco de ejemplo' || char(10) || 'Cuenta corriente: 000000000',
  default_user    = 'Ethen'
WHERE account_id = 2;

-- Cuatro facturas emitidas (FAC-0001..0004) y un borrador sin emitir.
UPDATE settings SET next_invoice_number = 5, next_draft_number = 2, next_quote_number = 4 WHERE account_id = 1;

INSERT INTO clients (id, account_id, name, name_key, email, phone, address, tax_id, times_used, last_used_at) VALUES
 (1, 1, 'Restaurante La Bodeguita', 'restaurante la bodeguita', 'gerencia@labodeguita.do', '(809) 555-0111', 'Av. Winston Churchill 45, Piantini', '130-45678-9', 3, datetime('now','-2 days')),
 (2, 1, 'Idalise Marte',            'idalise marte',            'idalise@mail.com',        '(829) 555-0177', 'Los Cacicazgos, Santo Domingo',      '', 2, datetime('now','-9 days')),
 (3, 1, 'Grupo Orión SRL',          'grupo orión srl',          'compras@grupoorion.com.do','(809) 555-0155', 'Torre Empresarial, Naco',           '131-99887-2', 1, datetime('now','-24 days')),
 (4, 1, 'Cafetería Stroke',         'cafetería stroke',         'hola@stroke.do',          '(849) 555-0122', 'Zona Colonial, Santo Domingo',      '', 1, datetime('now','-40 days'));

INSERT INTO services (id, account_id, name, name_key, description, unit_price_cents, unit, times_used, last_used_at) VALUES
 (1, 1, 'Sesión fotográfica de producto', 'sesión fotográfica de producto', 'Media jornada, hasta 15 productos', 1500000, 'sesión', 4, datetime('now','-2 days')),
 (2, 1, 'Edición y retoque',              'edición y retoque',              'Por imagen entregada',              45000,  'imagen', 3, datetime('now','-2 days')),
 (3, 1, 'Video promocional',              'video promocional',              'Reel de 30 s, guion incluido',      2800000, 'video',  2, datetime('now','-9 days')),
 (4, 1, 'Cobertura de evento',            'cobertura de evento',            'Hasta 4 horas',                     2200000, 'evento', 1, datetime('now','-24 days')),
 (5, 1, 'Diseño de miniatura',            'diseño de miniatura',            'Para YouTube, 2 propuestas',        60000,  'unidad', 1, datetime('now','-40 days'));

INSERT INTO invoices (id, account_id, number, client_id, client_name, client_email, client_phone, client_address, client_tax_id,
                      issue_date, due_date, status, paid_at, subtotal_cents, discount_type, discount_value,
                      discount_cents, total_cents, notes, payment_details) VALUES
 (1, 1, 'FAC-0001', 4, 'Cafetería Stroke', 'hola@stroke.do', '(849) 555-0122', 'Zona Colonial, Santo Domingo', '',
     date('now','-40 days'), date('now','-25 days'), 'paid', datetime('now','-27 days'),
     1620000, 'none', 0, 0, 1620000, 'Gracias por confiar en nosotros.', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos'),

 (2, 1, 'FAC-0002', 3, 'Grupo Orión SRL', 'compras@grupoorion.com.do', '(809) 555-0155', 'Torre Empresarial, Naco', '131-99887-2',
     date('now','-24 days'), date('now','-9 days'), 'paid', datetime('now','-12 days'),
     2200000, 'none', 0, 0, 2200000, 'Gracias por confiar en nosotros.', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos'),

 (3, 1, 'FAC-0003', 2, 'Idalise Marte', 'idalise@mail.com', '(829) 555-0177', 'Los Cacicazgos, Santo Domingo', '',
     date('now','-18 days'), date('now','-3 days'), 'pending', NULL,
     2800000, 'percent', 1000, 280000, 2520000, 'Gracias por confiar en nosotros.', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos'),

 (4, 1, 'FAC-0004', 1, 'Restaurante La Bodeguita', 'gerencia@labodeguita.do', '(809) 555-0111', 'Av. Winston Churchill 45, Piantini', '130-45678-9',
     date('now','-2 days'), date('now','+13 days'), 'pending', NULL,
     1950000, 'none', 0, 0, 1950000, 'Gracias por confiar en nosotros.', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos'),

 (5, 1, 'BOR-0001', 1, 'Restaurante La Bodeguita', 'gerencia@labodeguita.do', '(809) 555-0111', 'Av. Winston Churchill 45, Piantini', '130-45678-9',
     date('now'), NULL, 'draft', NULL,
     1500000, 'none', 0, 0, 1500000, '', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos');

INSERT INTO invoice_items (invoice_id, service_id, position, description, quantity_milli, unit, unit_price_cents, line_total_cents) VALUES
 (1, 5, 0, 'Diseño de miniatura',            2000, 'unidad',  60000,   120000),
 (1, 1, 1, 'Sesión fotográfica de producto', 1000, 'sesión', 1500000, 1500000),

 (2, 4, 0, 'Cobertura de evento',            1000, 'evento', 2200000, 2200000),

 (3, 3, 0, 'Video promocional',              1000, 'video',  2800000, 2800000),

 (4, 1, 0, 'Sesión fotográfica de producto', 1000, 'sesión', 1500000, 1500000),
 (4, 2, 1, 'Edición y retoque',             10000, 'imagen',   45000,  450000),

 (5, 1, 0, 'Sesión fotográfica de producto', 1000, 'sesión', 1500000, 1500000);

-- =====================================================================
-- COTIZACIONES  (kind = 'quote'; due_date significa "válida hasta")
-- =====================================================================
INSERT INTO invoices (id, account_id, number, kind, client_id, client_name, client_email, client_phone, client_address, client_tax_id,
                      issue_date, due_date, status, converted_to_id, subtotal_cents, discount_type, discount_value,
                      discount_cents, total_cents, notes, payment_details) VALUES
 (6, 1, 'COT-0001', 'quote', 3, 'Grupo Orión SRL', 'compras@grupoorion.com.do', '(809) 555-0155', 'Torre Empresarial, Naco', '131-99887-2',
     date('now','-6 days'), date('now','+24 days'), 'sent', NULL,
     3880000, 'none', 0, 0, 3880000, 'Precios válidos por 30 días.', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos'),

 (7, 1, 'COT-0002', 'quote', 2, 'Idalise Marte', 'idalise@mail.com', '(829) 555-0177', 'Los Cacicazgos, Santo Domingo', '',
     date('now','-45 days'), date('now','-15 days'), 'sent', NULL,
     2800000, 'none', 0, 0, 2800000, 'Precios válidos por 30 días.', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos'),

 (8, 1, 'COT-0003', 'quote', 4, 'Cafetería Stroke', 'hola@stroke.do', '(849) 555-0122', 'Zona Colonial, Santo Domingo', '',
     date('now','-3 days'), date('now','+27 days'), 'draft', NULL,
     600000, 'none', 0, 0, 600000, '', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos');

INSERT INTO invoice_items (invoice_id, service_id, position, description, quantity_milli, unit, unit_price_cents, line_total_cents) VALUES
 (6, 4, 0, 'Cobertura de evento',              1000, 'evento', 2200000, 2200000),
 (6, 2, 1, 'Edición y retoque',                4000, 'imagen',   45000,  180000),
 (6, 1, 2, 'Sesión fotográfica de producto',   1000, 'sesión', 1500000, 1500000),

 (7, 3, 0, 'Video promocional',                1000, 'video',  2800000, 2800000),

 (8, 5, 0, 'Diseño de miniatura',             10000, 'unidad',   60000,  600000);

-- =====================================================================
-- REMONT (cuenta 2): una factura con ITBIS y retenciones, para ver el
-- formato completo sin tener que teclearla a mano cada vez.
-- =====================================================================
INSERT INTO clients (id, account_id, name, name_key, email, phone, address, tax_id, times_used, last_used_at) VALUES
 (20, 2, 'Consultores & Asesores SRL', 'consultores & asesores srl', 'compras@ejemplo.do', '(809) 555-0190', 'Santo Domingo, República Dominicana', '130-02703-1', 1, datetime('now','-3 days'));

INSERT INTO services (id, account_id, name, name_key, description, unit_price_cents, unit, times_used, last_used_at) VALUES
 (20, 2, 'Mano de Obra: Mantenimiento', 'mano de obra: mantenimiento', '', 500000, 'unidad', 1, datetime('now','-3 days')),
 (21, 2, 'Materiales: Mantenimiento',   'materiales: mantenimiento',   '', 1176685, 'unidad', 1, datetime('now','-3 days'));

INSERT INTO invoices (id, account_id, number, kind, client_id, client_name, client_email, client_phone,
                      client_address, client_tax_id, issue_date, due_date, status,
                      service_place, service_date_text, credit_terms, quote_ref, prepared_by,
                      subtotal_cents, discount_type, discount_value, discount_cents,
                      tax_cents, retention_cents, total_cents, notes, payment_details) VALUES
 (20, 2, '00024', 'invoice', 20, 'Consultores & Asesores SRL', 'compras@ejemplo.do', '(809) 555-0190',
     'Santo Domingo, República Dominicana', '130-02703-1',
     date('now','-3 days'), date('now','+4 days'), 'pending',
     'Tienda de ejemplo (Ágora Mall)', 'Por definir', '50% Adelanto - 50% Contra Entrega', 'COT-0013', 'Ethen',
     1676685, 'none', 0, 0, 301803, 335337, 1643151,
     'Las cancelaciones deben notificarse con un mínimo de 24 horas de anticipación.',
     'Banco de ejemplo' || char(10) || 'Cuenta corriente: 000000000');

INSERT INTO invoice_items (invoice_id, service_id, position, description, detail, quantity_milli, unit, unit_price_cents, line_total_cents) VALUES
 (20, 20, 0, 'Mano de Obra: Mantenimiento', 'Tapar hueco en la entrada' || char(10) || 'Corregir fisuras en la puerta' || char(10) || 'Reparar sheet rock en el almacén', 1000, 'unidad', 500000, 500000),
 (20, 21, 1, 'Materiales: Mantenimiento',   'Materiales varios para albañilería', 1000, 'unidad', 1176685, 1176685);

INSERT INTO invoice_adjustments (invoice_id, rule_id, position, name, kind, base, rate_bp, amount_cents) VALUES
 (20, 1, 0, 'ITBIS 18%',  'tax',       'subtotal',  1800, 301803),
 (20, 2, 1, 'ITBIS Ret.', 'retention', 'taxes',    10000, 301803),
 (20, 3, 2, 'ISR 2%',     'retention', 'subtotal',   200,  33534);
`
