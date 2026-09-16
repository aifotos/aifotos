import { query, queryOne, execute, cuentaActual } from './index.js'
import { lineTotal } from '../lib/money.js'

export const payments = (id) => query('SELECT * FROM mis_pagos WHERE invoice_id=$1 ORDER BY paid_on DESC, created_at DESC', [id])
export async function addPayment({ id, invoice_id, amount_cents, paid_on, note }) {
  if (!Number.isSafeInteger(amount_cents) || amount_cents <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(paid_on)) throw new Error('Indica un importe positivo y una fecha válida')
  await execute('INSERT INTO payments(id,invoice_id,amount_cents,paid_on,note) VALUES($1,$2,$3,$4,$5)', [id,invoice_id,amount_cents,paid_on,note.trim()])
}
export async function removePayment(id) {
  await execute('DELETE FROM payments WHERE id=$1 AND invoice_id IN (SELECT id FROM facturas)', [id])
}
export const costs = () => query('SELECT * FROM mis_costos ORDER BY incurred_on DESC,id DESC')
export const documents = () => query('SELECT id,number,client_name,kind FROM mis_documentos ORDER BY id DESC')
export async function saveCost(c) {
  if (!c.description.trim() || !c.incurred_on || !Number.isSafeInteger(c.quantity_milli) || c.quantity_milli<=0 || !Number.isSafeInteger(c.unit_price_cents) || c.unit_price_cents<0) throw new Error('Revisa la descripción, la fecha y los importes')
  const amount = lineTotal(c.quantity_milli,c.unit_price_cents)
  if (!Number.isSafeInteger(amount)) throw new Error('El importe es demasiado grande')
  const account = await cuentaActual()
  const values = [c.document_id || null,c.project.trim(),c.description.trim(),c.category,c.stage,c.incurred_on,c.quantity_milli,c.unit_price_cents,amount,c.supplier.trim(),c.notes.trim()]
  if(c.id) await execute(`UPDATE costs SET document_id=$1,project=$2,description=$3,category=$4,stage=$5,incurred_on=$6,quantity_milli=$7,unit_price_cents=$8,amount_cents=$9,supplier=$10,notes=$11 WHERE id=$12 AND account_id=$13`,[...values,c.id,account])
  else await execute(`INSERT INTO costs(document_id,project,description,category,stage,incurred_on,quantity_milli,unit_price_cents,amount_cents,supplier,notes,account_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[...values,account])
}
export async function removeCost(id) { await execute('DELETE FROM costs WHERE id=$1 AND account_id=$2',[id,await cuentaActual()]) }
export async function overview(from,to) {
  const [billed, cash, quotes, spending] = await Promise.all([
    queryOne(`SELECT COALESCE(SUM(total_cents),0) AS billed, COALESCE(SUM(paid_cents),0) AS collected,
      COALESCE(SUM(subtotal_cents-discount_cents),0) AS revenue FROM facturas_saldos
      WHERE status IN ('pending','paid') AND issue_date BETWEEN $1 AND $2`,[from,to]),
    queryOne(`SELECT COALESCE(SUM(amount_cents),0) AS cash FROM mis_pagos WHERE paid_on BETWEEN $1 AND $2`,[from,to]),
    queryOne(`SELECT COUNT(*) AS sent,COUNT(converted_to_id) AS converted FROM cotizaciones WHERE status!='draft' AND issue_date BETWEEN $1 AND $2`,[from,to]),
    queryOne(`SELECT COALESCE(SUM(CASE WHEN category='cost' AND stage='actual' THEN amount_cents ELSE 0 END),0) AS costs,
      COALESCE(SUM(CASE WHEN category='expense' AND stage='actual' THEN amount_cents ELSE 0 END),0) AS expenses,
      COALESCE(SUM(CASE WHEN stage='planned' THEN amount_cents ELSE 0 END),0) AS planned
      FROM mis_costos WHERE incurred_on BETWEEN $1 AND $2`,[from,to]),
  ])
  return {...billed,...cash,...quotes,...spending}
}
