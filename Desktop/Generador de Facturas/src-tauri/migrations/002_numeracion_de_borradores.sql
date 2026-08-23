-- =====================================================================
-- Numeracion separada para borradores
-- =====================================================================
-- Un borrador no debe consumir un numero de factura: si escribes tres
-- borradores y solo emites uno, los otros dos habrian dejado dos huecos
-- permanentes en la numeracion fiscal.
--
-- La solucion es una segunda secuencia. Los borradores usan 'BOR-0001',
-- 'BOR-0002'... (que existen solo para cumplir la restriccion UNIQUE de
-- `invoices.number`; en pantalla se muestran como "Borrador"), y el
-- numero real 'FAC-0007' se reserva unicamente al emitir.
--
-- Se hace con ADD COLUMN, que SQLite soporta de forma nativa y sin
-- reconstruir la tabla. Cambiar `invoices.number` a NULL habria obligado
-- a recrear `invoices`, y al soltarla el ON DELETE CASCADE de
-- `invoice_items` habria borrado las lineas de todas las facturas.

ALTER TABLE settings ADD COLUMN next_draft_number INTEGER NOT NULL DEFAULT 1;
