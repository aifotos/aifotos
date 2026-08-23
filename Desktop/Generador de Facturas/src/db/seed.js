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
  email           = 'aifotos.contacto@gmail.com',
  phone           = '(809) 555-0134',
  address         = 'Santo Domingo, República Dominicana',
  default_notes   = 'Gracias por confiar en nosotros.',
  payment_details = 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos'
WHERE id = 1;

UPDATE settings SET next_invoice_number = 6 WHERE id = 1;

INSERT INTO clients (id, name, name_key, email, phone, address, tax_id, times_used, last_used_at) VALUES
 (1, 'Restaurante La Bodeguita', 'restaurante la bodeguita', 'gerencia@labodeguita.do', '(809) 555-0111', 'Av. Winston Churchill 45, Piantini', '130-45678-9', 3, datetime('now','-2 days')),
 (2, 'Idalise Marte',            'idalise marte',            'idalise@mail.com',        '(829) 555-0177', 'Los Cacicazgos, Santo Domingo',      '', 2, datetime('now','-9 days')),
 (3, 'Grupo Orión SRL',          'grupo orión srl',          'compras@grupoorion.com.do','(809) 555-0155', 'Torre Empresarial, Naco',           '131-99887-2', 1, datetime('now','-24 days')),
 (4, 'Cafetería Stroke',         'cafetería stroke',         'hola@stroke.do',          '(849) 555-0122', 'Zona Colonial, Santo Domingo',      '', 1, datetime('now','-40 days'));

INSERT INTO services (id, name, name_key, description, unit_price_cents, unit, times_used, last_used_at) VALUES
 (1, 'Sesión fotográfica de producto', 'sesión fotográfica de producto', 'Media jornada, hasta 15 productos', 1500000, 'sesión', 4, datetime('now','-2 days')),
 (2, 'Edición y retoque',              'edición y retoque',              'Por imagen entregada',              45000,  'imagen', 3, datetime('now','-2 days')),
 (3, 'Video promocional',              'video promocional',              'Reel de 30 s, guion incluido',      2800000, 'video',  2, datetime('now','-9 days')),
 (4, 'Cobertura de evento',            'cobertura de evento',            'Hasta 4 horas',                     2200000, 'evento', 1, datetime('now','-24 days')),
 (5, 'Diseño de miniatura',            'diseño de miniatura',            'Para YouTube, 2 propuestas',        60000,  'unidad', 1, datetime('now','-40 days'));

INSERT INTO invoices (id, number, client_id, client_name, client_email, client_phone, client_address, client_tax_id,
                      issue_date, due_date, status, paid_at, subtotal_cents, discount_type, discount_value,
                      discount_cents, total_cents, notes, payment_details) VALUES
 (1, 'FAC-0001', 4, 'Cafetería Stroke', 'hola@stroke.do', '(849) 555-0122', 'Zona Colonial, Santo Domingo', '',
     date('now','-40 days'), date('now','-25 days'), 'paid', datetime('now','-27 days'),
     1620000, 'none', 0, 0, 1620000, 'Gracias por confiar en nosotros.', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos'),

 (2, 'FAC-0002', 3, 'Grupo Orión SRL', 'compras@grupoorion.com.do', '(809) 555-0155', 'Torre Empresarial, Naco', '131-99887-2',
     date('now','-24 days'), date('now','-9 days'), 'paid', datetime('now','-12 days'),
     2200000, 'none', 0, 0, 2200000, 'Gracias por confiar en nosotros.', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos'),

 (3, 'FAC-0003', 2, 'Idalise Marte', 'idalise@mail.com', '(829) 555-0177', 'Los Cacicazgos, Santo Domingo', '',
     date('now','-18 days'), date('now','-3 days'), 'pending', NULL,
     2800000, 'percent', 1000, 280000, 2520000, 'Gracias por confiar en nosotros.', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos'),

 (4, 'FAC-0004', 1, 'Restaurante La Bodeguita', 'gerencia@labodeguita.do', '(809) 555-0111', 'Av. Winston Churchill 45, Piantini', '130-45678-9',
     date('now','-2 days'), date('now','+13 days'), 'pending', NULL,
     1950000, 'none', 0, 0, 1950000, 'Gracias por confiar en nosotros.', 'Banco Popular · Cuenta de ahorros 123-456789-0 · AIFotos'),

 (5, 'FAC-0005', 1, 'Restaurante La Bodeguita', 'gerencia@labodeguita.do', '(809) 555-0111', 'Av. Winston Churchill 45, Piantini', '130-45678-9',
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
`
