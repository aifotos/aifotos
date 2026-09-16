import { useEffect, useState } from 'react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Field, { inputClass } from '../components/ui/Field.jsx'
import { overview } from '../db/finance.js'
import { today } from '../lib/dates.js'
import { formatMoney } from '../lib/money.js'

export default function Analytics({moneda}) {
 const [from,setFrom]=useState(today().slice(0,4)+'-01-01'),[to,setTo]=useState(today()),[data,setData]=useState(null),[error,setError]=useState('')
 useEffect(()=>{let live=true;setData(null);setError('');if(!from||!to||from>to){setError('Revisa el intervalo de fechas');return}overview(from,to).then(d=>live&&setData(d)).catch(e=>live&&setError(String(e)));return()=>{live=false}},[from,to])
 const money=n=>formatMoney(n,moneda)
 const conversion=data?.sent?data.converted/data.sent*100:0
 return <><PageHeader title="Dashboard" subtitle="Resultados de la empresa seleccionada"/>
 <div className="px-8 py-6 space-y-6">
 <div className="flex gap-4"><Field label="Desde"><input type="date" className={inputClass} value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label="Hasta"><input type="date" className={inputClass} value={to} onChange={e=>setTo(e.target.value)}/></Field></div>
 {error&&<p role="alert" className="text-overdue-ink">{error}</p>}{!data&&!error&&<p>Cargando resultados…</p>}
 {data&&<>
 <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[
 ['Conversión',`${conversion.toFixed(1)} %`,`${data.converted} de ${data.sent} cotizaciones emitidas en el período`],
 ['Facturado neto',money(data.billed),'Facturas emitidas en el período, con impuestos y retenciones'],
 ['Cobrado de esas facturas',money(data.collected),'Abonos registrados para esas facturas'],
 ['Saldo por cobrar',money(data.billed-data.collected),'Saldo actual de las facturas del período']
 ].map(([title,value,hint])=><div key={title} className="bg-surface border border-line rounded-xl p-5"><p className="text-sm text-ink-soft">{title}</p><p className="text-2xl font-semibold mt-3">{value}</p><p className="text-xs text-ink-soft mt-2">{hint}</p></div>)}</div>
 <div className="bg-surface border border-line rounded-xl p-6"><h2 className="font-semibold">Cobrado vs. facturado</h2><div className="h-3 bg-line rounded-full overflow-hidden mt-4"><div className="h-full bg-brand-600" style={{width:`${data.billed?Math.min(100,data.collected/data.billed*100):0}%`}}/></div><p className="text-sm text-ink-soft mt-3">Entradas de dinero por fecha de pago en este período: <b>{money(data.cash)}</b>. Esta cifra puede incluir facturas de otros períodos.</p></div>
 <div className="bg-surface border border-line rounded-xl p-6"><h2 className="font-semibold">Estado de resultados operativo</h2><p className="text-xs text-ink-soft mt-1 mb-5">Ingresos por fecha de factura; costos y gastos por fecha de realización. Los costos previstos no se descuentan.</p>
 {[
 ['Ingresos por servicios y productos',data.revenue],['− Costos directos realizados',-data.costs],['Resultado bruto',data.revenue-data.costs],['− Gastos realizados',-data.expenses],['Resultado operativo',data.revenue-data.costs-data.expenses]
 ].map(([label,amount])=><div className="flex justify-between py-3 border-t border-line" key={label}><span>{label}</span><b>{money(amount)}</b></div>)}
 <p className="text-xs text-ink-soft mt-4">Ingresos después de descuentos, sin impuestos ni retenciones. Costos y gastos según los importes registrados. Presupuesto aún previsto en este período: {money(data.planned)}.</p></div>
 </>}
 </div></>
}
