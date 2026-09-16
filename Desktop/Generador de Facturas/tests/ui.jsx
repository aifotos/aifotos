// Harness de desarrollo: solo datos ficticios de sql.js, nunca SQLite nativo.
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import AppShell from '../src/components/layout/AppShell.jsx'
import Dashboard from '../src/pages/Dashboard.jsx'
import Analytics from '../src/pages/Analytics.jsx'
import Costs from '../src/pages/Costs.jsx'
import Services from '../src/pages/Services.jsx'
import InvoiceEditor from '../src/pages/InvoiceEditor.jsx'
import { execute, fijarCuenta } from '../src/db/index.js'
import * as settings from '../src/db/settings.js'
function Harness(){
 const [section,setSection]=useState('analytics'),[editor,setEditor]=useState(null),[config,setConfig]=useState(null)
 useEffect(()=>{execute('UPDATE sesion SET account_id=1 WHERE id=1').then(()=>{fijarCuenta(1);return settings.get()}).then(setConfig)},[])
 if(!config)return <p>Cargando prueba…</p>
 if(editor)return <InvoiceEditor key={`${editor.kind}-${editor.id}`} ajustes={config} facturaId={editor.id} kind={editor.kind} onSalir={()=>setEditor(null)} onAbrirFactura={f=>setEditor(f)}/>
 return <AppShell seccion={section} onNavegar={setSection} onNuevaFactura={()=>setEditor({id:null,kind:section==='quotes'?'quote':'invoice'})} cuenta={{username:'prueba'}} negocio="Empresa de prueba" onSalir={()=>location.reload()}>
 {section==='analytics'&&<Analytics moneda="RD$"/>}{section==='costs'&&<Costs moneda="RD$"/>}{section==='services'&&<Services moneda="RD$"/>}
 {['invoices','quotes'].includes(section)&&<Dashboard key={section} kind={section==='quotes'?'quote':'invoice'} onAbrirFactura={setEditor} onNuevaFactura={()=>setEditor({id:null,kind:section==='quotes'?'quote':'invoice'})}/>}
 </AppShell>
}
if(import.meta.env.DEV && !('__TAURI_INTERNALS__' in window)) createRoot(document.getElementById('root')).render(<Harness/> )
