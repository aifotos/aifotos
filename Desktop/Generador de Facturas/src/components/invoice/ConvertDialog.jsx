import { useEffect, useRef, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { documentTotals, formatMoney } from '../../lib/money.js'
import * as quotes from '../../db/quotes.js'

export default function ConvertDialog({ quoteId,onCerrar,onConverted }) {
 const [quote,setQuote]=useState(null),[ids,setIds]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const lock=useRef(false)
 useEffect(()=>{let live=true;quotes.getFull(quoteId).then(q=>{if(live){setQuote(q);setIds(q.items.map(i=>i.id))}}).catch(e=>live&&setError(String(e)));return()=>{live=false}},[quoteId])
 const items=quote?.items.filter(i=>ids.includes(i.id))??[]
 const total=quote?documentTotals(items,quote.discount_type,quote.discount_value,quote.adjustments).total_cents:0
 async function convert(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const f=await quotes.convertirEnFactura(quoteId,{itemIds:ids});onConverted(f)}catch(e){setError(String(e?.message??e));lock.current=false;setBusy(false)}}
 return <Modal abierto onCerrar={()=>!busy&&onCerrar()} title="Elegir líneas para facturar" ancho="max-w-lg" description="Desmarca las líneas que no vas a facturar. La cotización original conserva todas sus líneas." acciones={<><Button disabled={busy} onClick={onCerrar}>Cancelar</Button><Button variant="primary" disabled={busy||!items.length} onClick={convert}>{busy?'Convirtiendo…':'Crear factura'}</Button></>}>
 <div className="space-y-3 max-h-80 overflow-auto">{quote?.items.map(i=><label key={i.id} className="flex gap-3 items-center border-b border-line py-3"><input type="checkbox" checked={ids.includes(i.id)} disabled={busy} onChange={e=>setIds(prev=>e.target.checked?[...prev,i.id]:prev.filter(id=>id!==i.id))}/><span className="flex-1">{i.description}</span><span>{formatMoney(i.line_total_cents,quote.currency_symbol)}</span></label>)}</div>
 <p className="mt-4 font-semibold">Total recalculado: {formatMoney(total,quote?.currency_symbol)}</p><p className="text-xs text-ink-soft mt-1">Se conservan las reglas de impuestos, retenciones y descuento. Los importes fijos mantienen su valor.</p>
 {error&&<p role="alert" className="text-overdue-ink mt-3">{error}</p>}
 </Modal>
}
