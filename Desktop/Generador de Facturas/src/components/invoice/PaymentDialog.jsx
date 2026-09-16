import { useEffect, useRef, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Field, { inputClass } from '../ui/Field.jsx'
import { formatMoney } from '../../lib/money.js'
import { today } from '../../lib/dates.js'
import * as finance from '../../db/finance.js'
import * as invoices from '../../db/invoices.js'

export default function PaymentDialog({ invoice, onCerrar, onGuardado }) {
  const [rows,setRows]=useState([]), [current,setCurrent]=useState(null)
  const [value,setValue]=useState(''), [mode,setMode]=useState('amount'), [date,setDate]=useState(today())
  const [note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[remove,setRemove]=useState(null)
  const lock=useRef(false), token=useRef(crypto.randomUUID())
  async function reload() {
    const [r,i]=await Promise.all([finance.payments(invoice.id),invoices.getFull(invoice.id)])
    setRows(r);setCurrent(i)
    return i
  }
  useEffect(()=>{let active=true; Promise.all([finance.payments(invoice.id),invoices.getFull(invoice.id)]).then(([r,i])=>{if(active){setRows(r);setCurrent(i)}}).catch(e=>active&&setError(String(e))); return()=>{active=false}},[invoice.id])
  const total=current?.total_cents??0, paid=current?.paid_cents??0, balance=total-paid
  const amount=mode==='percent'?Math.round(total*Number(value)/100):Math.round(Number(value)*100)
  async function act(fn) {
    if(lock.current)return
    lock.current=true;setBusy(true);setError('')
    try {await fn();const i=await reload();onGuardado(i);setValue('');setRemove(null);token.current=crypto.randomUUID()}
    catch(e){setError(String(e?.message??e))} finally{lock.current=false;setBusy(false)}
  }
  return <Modal abierto onCerrar={()=>!busy&&onCerrar()} title="Pagos de la factura" ancho="max-w-lg" description={invoice.number} acciones={<><Button onClick={onCerrar} disabled={busy}>Cerrar</Button><Button variant="primary" disabled={busy||!current||!(amount>0)||amount>balance||current.status==='draft'} onClick={()=>act(()=>finance.addPayment({id:token.current,invoice_id:invoice.id,amount_cents:amount,paid_on:date,note}))}>Registrar abono</Button></>}>
    <div className="space-y-4">
      <div className="rounded-xl bg-canvas p-3 text-sm">Cobrado: <b>{formatMoney(paid)}</b> · Saldo: <b>{formatMoney(balance)}</b>{total>0&&<p>{(paid/total*100).toFixed(1)} % pagado</p>}</div>
      {current?.credit_terms&&<p className="text-sm text-ink-soft">Condición acordada: {current.credit_terms}</p>}
      <div className="grid grid-cols-2 gap-3"><Field label="Registrar por"><select className={inputClass} value={mode} onChange={e=>setMode(e.target.value)}><option value="amount">Importe del abono</option><option value="percent">% del total de la factura</option></select></Field><Field label={mode==='percent'?'Porcentaje adicional':'Importe (RD$)'}><input className={inputClass} type="number" min="0" step="0.01" value={value} onChange={e=>setValue(e.target.value)}/></Field></div>
      <p className="text-xs text-ink-soft">Este abono añade {formatMoney(Number.isFinite(amount)?amount:0)} a lo ya cobrado.</p>
      <Button size="sm" onClick={()=>{setMode('amount');setValue(String(balance/100))}}>Completar saldo pendiente</Button>
      <Field label="Fecha del pago"><input type="date" className={inputClass} value={date} onChange={e=>setDate(e.target.value)}/></Field>
      <Field label="Referencia o nota"><input className={inputClass} value={note} onChange={e=>setNote(e.target.value)} placeholder="Transferencia, efectivo…"/></Field>
      <div className="max-h-48 overflow-auto space-y-2">{rows.map(p=><div key={p.id} className="border-t border-line pt-2 text-sm"><div className="flex justify-between"><span>{p.paid_on} · {formatMoney(p.amount_cents)}</span><button className="text-overdue-ink" disabled={busy} onClick={()=>setRemove(p.id)}>Eliminar</button></div><p className="text-xs text-ink-soft">{p.note}</p>{remove===p.id&&<div className="flex gap-2 mt-2"><Button size="sm" variant="danger" disabled={busy} onClick={()=>act(()=>finance.removePayment(p.id))}>Confirmar eliminación</Button><Button size="sm" onClick={()=>setRemove(null)}>Cancelar</Button></div>}</div>)}</div>
      {error&&<p role="alert" className="text-sm text-overdue-ink">{error}</p>}
    </div>
  </Modal>
}
