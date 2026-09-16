import { useEffect, useState } from 'react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import Field, { inputClass } from '../components/ui/Field.jsx'
import { formatMoney, lineTotal } from '../lib/money.js'
import { today } from '../lib/dates.js'
import * as finance from '../db/finance.js'

const blank=()=>({description:'',project:'',document_id:'',category:'cost',stage:'planned',incurred_on:today(),quantity:'1',price:'',supplier:'',notes:''})
export default function Costs({moneda}) {
 const [rows,setRows]=useState([]),[docs,setDocs]=useState([]),[form,setForm]=useState(null),[search,setSearch]=useState(''),[stage,setStage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[remove,setRemove]=useState(null)
 async function refresh(){const [c,d]=await Promise.all([finance.costs(),finance.documents()]);setRows(c);setDocs(d)}
 useEffect(()=>{refresh().catch(e=>setError(String(e)))},[])
 const filtered=rows.filter(r=>(!stage||r.stage===stage)&&`${r.description} ${r.project} ${r.supplier} ${r.document_number??''}`.toLowerCase().includes(search.toLowerCase()))
 const field=(name)=>e=>setForm({...form,[name]:e.target.value})
 async function save(){if(busy)return;setBusy(true);setError('');try{
 const q=Number(form.quantity),p=Number(form.price)
 if(!form.quantity||!form.price||!Number.isFinite(q)||q<=0||!Number.isFinite(p)||p<0)throw new Error('Indica una cantidad positiva y un precio válido')
 await finance.saveCost({...form,document_id:form.document_id?Number(form.document_id):null,quantity_milli:Math.round(q*1000),unit_price_cents:Math.round(p*100)})
 await refresh();setForm(null)
 }catch(e){setError(String(e?.message??e))}finally{setBusy(false)}}
 async function destroy(){setBusy(true);try{await finance.removeCost(remove.id);await refresh();setRemove(null)}catch(e){setError(String(e))}finally{setBusy(false)}}
 return <><PageHeader title="Costos y gastos" subtitle="Materiales, mano de obra y gastos del negocio" actions={<Button variant="primary" onClick={()=>{setError('');setForm(blank())}}>Añadir línea</Button>}/>
 <div className="px-8 py-6 space-y-5">
 <div className="grid grid-cols-2 gap-4">{[['Previsto','planned'],['Realizado','actual']].map(([label,s])=><div className="bg-surface border border-line p-5 rounded-xl" key={s}><p className="text-sm text-ink-soft">{label} · lista filtrada</p><p className="text-2xl font-semibold mt-2">{formatMoney(filtered.filter(r=>r.stage===s).reduce((sum,r)=>sum+r.amount_cents,0),moneda)}</p></div>)}</div>
 <div className="flex gap-3"><input aria-label="Buscar costos" className={inputClass} placeholder="Buscar material, trabajo, proveedor o documento…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Estado del costo" className={inputClass} value={stage} onChange={e=>setStage(e.target.value)}><option value="">Todos los estados</option><option value="planned">Previstos</option><option value="actual">Realizados</option></select></div>
 <p className="text-xs text-ink-soft">Cada fila representa un costo. Al comprar un material previsto, edita esa misma fila y cambia su estado a realizado.</p>
 {error&&!form&&<p role="alert" className="text-overdue-ink">{error}</p>}
 <div className="bg-surface border border-line rounded-xl overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-canvas text-ink-soft"><tr>{['Fecha / trabajo','Material o concepto','Tipo / estado','Cantidad × precio','Total',''].map((s,i)=><th className="p-4" key={i}>{s}</th>)}</tr></thead><tbody>{filtered.map(r=><tr className="border-t border-line" key={r.id}><td className="p-4">{r.incurred_on}<p className="text-xs text-ink-soft">{r.project||r.document_number||'General'}</p></td><td className="p-4">{r.description}<p className="text-xs text-ink-soft">{r.supplier}</p></td><td className="p-4">{r.category==='cost'?'Costo directo':'Gasto'}<p className="text-xs text-ink-soft">{r.stage==='actual'?'Realizado':'Previsto'}</p></td><td className="p-4">{r.quantity_milli/1000} × {formatMoney(r.unit_price_cents,moneda)}</td><td className="p-4 font-semibold whitespace-nowrap">{formatMoney(r.amount_cents,moneda)}</td><td className="p-4"><Button size="sm" onClick={()=>{setError('');setForm({...r,document_id:r.document_id??'',quantity:String(r.quantity_milli/1000),price:String(r.unit_price_cents/100)})}}>Editar</Button><button className="ml-3 text-overdue-ink" onClick={()=>setRemove(r)}>Eliminar</button></td></tr>)}</tbody></table>{!filtered.length&&<p className="p-10 text-center text-ink-soft">Todavía no hay costos que mostrar.</p>}</div>
 </div>
 <Modal abierto={!!form} onCerrar={()=>!busy&&setForm(null)} title={form?.id?'Editar costo o gasto':'Añadir costo o gasto'} ancho="max-w-2xl" acciones={<><Button disabled={busy} onClick={()=>setForm(null)}>Cancelar</Button><Button disabled={busy} variant="primary" onClick={save}>Guardar línea</Button></>}>
 {form&&<div className="grid grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto pr-1">
 <Field label="Material o concepto"><input className={inputClass} value={form.description} onChange={field('description')}/></Field><Field label="Trabajo / proyecto"><input className={inputClass} value={form.project} onChange={field('project')}/></Field>
 <Field label="Vincular a documento (opcional)"><select className={inputClass} value={form.document_id} onChange={field('document_id')}><option value="">Sin documento</option>{docs.map(d=><option key={d.id} value={d.id}>{d.number} · {d.client_name}</option>)}</select></Field>
 <Field label="Fecha prevista o de realización"><input type="date" className={inputClass} value={form.incurred_on} onChange={field('incurred_on')}/></Field>
 <Field label="Tipo"><select className={inputClass} value={form.category} onChange={field('category')}><option value="cost">Costo directo del trabajo</option><option value="expense">Gasto del negocio</option></select></Field>
 <Field label="Estado"><select className={inputClass} value={form.stage} onChange={field('stage')}><option value="planned">Previsto</option><option value="actual">Realizado</option></select></Field>
 <Field label="Cantidad"><input type="number" min="0.001" step="0.001" className={inputClass} value={form.quantity} onChange={field('quantity')}/></Field><Field label={`Costo unitario (${moneda})`}><input type="number" min="0" step="0.01" className={inputClass} value={form.price} onChange={field('price')}/></Field>
 <Field label="Proveedor (opcional)"><input className={inputClass} value={form.supplier} onChange={field('supplier')}/></Field><Field label="Notas"><input className={inputClass} value={form.notes} onChange={field('notes')}/></Field>
 <p className="font-semibold col-span-2">Total: {formatMoney(lineTotal(Math.round(Number(form.quantity)*1000),Math.round(Number(form.price)*100)),moneda)}</p>
 {error&&<p className="col-span-2 text-overdue-ink" role="alert">{error}</p>}
 </div>}
 </Modal>
 <Modal abierto={!!remove} onCerrar={()=>!busy&&setRemove(null)} title="¿Eliminar esta línea?" description={remove?.description} acciones={<><Button disabled={busy} onClick={()=>setRemove(null)}>Cancelar</Button><Button disabled={busy} variant="danger" onClick={destroy}>Eliminar</Button></>}/>
 </>
}
