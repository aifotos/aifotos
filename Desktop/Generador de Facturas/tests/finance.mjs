import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import initSqlJs from 'sql.js'
import { createServer } from 'vite'

const SQL = await initSqlJs()
const db = new SQL.Database()
db.run('PRAGMA foreign_keys=ON')
const migrations = fs.readdirSync('src-tauri/migrations').sort()
for(const file of migrations.slice(0,4)) db.exec(fs.readFileSync(`src-tauri/migrations/${file}`,'utf8'))
db.run("UPDATE sesion SET account_id=1")
db.run("INSERT INTO invoices(account_id,number,kind,issue_date,status,total_cents) VALUES(1,'LEGACY','invoice','2026-09-01','paid',10000)")
for(const file of migrations.slice(4)) db.exec(fs.readFileSync(`src-tauri/migrations/${file}`,'utf8'))
function query(sql,params=[]){const stmt=db.prepare(sql);try{stmt.bind(/\$\d+/.test(sql)?Object.fromEntries(params.map((p,i)=>[`$${i+1}`,p])):params);const r=[];while(stmt.step())r.push(stmt.getAsObject());return r}finally{stmt.free()}}
function execute(sql,params=[]){query(sql,params);return {rowsAffected:db.getRowsModified(),lastInsertId:query('SELECT last_insert_rowid() AS id')[0].id}}
globalThis.__financeDb={query,execute,async atomico(statements){db.run('BEGIN');try{for(const s of statements)execute(s.sql,s.params);db.run('COMMIT')}catch(e){db.run('ROLLBACK');throw e}}}
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',plugins:[{name:'test-database',enforce:'pre',load(id){if(id===path.resolve('src/db/index.js'))return `
export const query=async (...a)=>globalThis.__financeDb.query(...a);
export const queryOne=async (...a)=>(await query(...a))[0]??null;
export const execute=async (...a)=>globalThis.__financeDb.execute(...a);
export const atomico=(...a)=>globalThis.__financeDb.atomico(...a);
export const cuentaActual=async ()=>(await queryOne('SELECT account_id FROM sesion WHERE id=1')).account_id;
export const nameKey=n=>String(n??'').trim().replace(/\\s+/g,' ').toLowerCase();`}}]})
try {
 const invoices=await server.ssrLoadModule('/src/db/invoices.js')
 const quotes=await server.ssrLoadModule('/src/db/quotes.js')
 const finance=await server.ssrLoadModule('/src/db/finance.js')
 const services=await server.ssrLoadModule('/src/db/services.js')
 const clients=await server.ssrLoadModule('/src/db/clients.js')
 assert.equal((await invoices.getFull(1)).paid_cents,10000,'existing paid invoice backfilled')
 const draft={kind:'invoice',client:{name:'Test client'},items:[{description:'Service',quantity_milli:1000,unit_price_cents:10000}],issue_date:'2026-09-16',status:'pending'}
 const invoice=await invoices.save(draft)
 assert.equal((await invoices.save({...draft,id:invoice.id,number:invoice.number,status:'draft'})).status,'pending','queued draft cannot undo issue')
 await finance.addPayment({id:'p1',invoice_id:invoice.id,amount_cents:3000,paid_on:'2026-09-16',note:'30%'})
 let updated=await invoices.getFull(invoice.id)
 assert.equal((await invoices.list({status:'partial'})).length,1)
 assert.equal(updated.paid_cents,3000);assert.equal(updated.status,'pending')
 await assert.rejects(()=>finance.addPayment({id:'over',invoice_id:invoice.id,amount_cents:8000,paid_on:'2026-09-16',note:''}))
 await assert.rejects(()=>finance.addPayment({id:'p1',invoice_id:invoice.id,amount_cents:3000,paid_on:'2026-09-16',note:''}))
 assert.equal((await finance.payments(invoice.id)).length,1)
 await finance.addPayment({id:'p2',invoice_id:invoice.id,amount_cents:7000,paid_on:'2026-09-16',note:''})
 assert.equal((await invoices.getFull(invoice.id)).status,'paid')
 await assert.rejects(()=>invoices.save({...draft,id:invoice.id,number:invoice.number,items:[{...draft.items[0],unit_price_cents:9000}]}))
 assert.equal((await invoices.getFull(invoice.id)).items[0].unit_price_cents,10000,'failed edit rolled back')
 await finance.removePayment('p2');assert.equal((await invoices.getFull(invoice.id)).status,'pending')
 const quote=await quotes.save({...draft,kind:'quote',status:'sent',items:[...draft.items,{description:'Excluded',quantity_milli:2000,unit_price_cents:5000}],adjustments:[{name:'tax',kind:'tax',base:'subtotal',rate_bp:1800}],notes:'Quote-specific note'})
 await assert.rejects(()=>quotes.convertirEnFactura(quote.id,{itemIds:[]}))
 const original=await quotes.getFull(quote.id)
 const converted=await quotes.convertirEnFactura(quote.id,{itemIds:[original.items[0].id]})
 assert.equal(converted.items.length,1);assert.equal(converted.total_cents,11800)
 assert.equal((await quotes.getFull(quote.id)).items.length,2)
 assert.notEqual(converted.notes,'Quote-specific note')
 const service=await services.getByName('Service')
 await services.update(service.id,{...service,unit_price_cents:15000})
 await invoices.save({...draft,id:invoice.id,number:invoice.number})
 assert.equal((await services.getById(service.id)).unit_price_cents,15000,'saving historical invoice does not overwrite catalog edits')
 assert.equal((await invoices.getFull(converted.id)).items[0].unit_price_cents,10000,'catalog edit does not alter other documents')
 await assert.rejects(()=>quotes.convertirEnFactura(quote.id))
 const count=query('SELECT COUNT(*) AS n FROM invoices')[0].n
 await assert.rejects(()=>invoices.save({...draft,sourceQuoteId:quote.id}))
 assert.equal(query('SELECT COUNT(*) AS n FROM invoices')[0].n,count,'duplicate conversion rolled back header and lines')
 await finance.saveCost({description:'Materials',project:'Work',document_id:quote.id,category:'cost',stage:'actual',incurred_on:'2026-09-16',quantity_milli:2500,unit_price_cents:1000,supplier:'',notes:''})
 await finance.saveCost({description:'Office',project:'',category:'expense',stage:'actual',incurred_on:'2026-09-16',quantity_milli:1000,unit_price_cents:500,supplier:'',notes:''})
 await finance.saveCost({description:'Future',project:'',category:'cost',stage:'planned',incurred_on:'2026-09-16',quantity_milli:1000,unit_price_cents:9999,supplier:'',notes:''})
 let report=await finance.overview('2026-09-01','2026-09-30')
 assert.equal(report.costs,2500);assert.equal(report.expenses,500);assert.equal(report.planned,9999)
 assert.equal(report.sent,1);assert.equal(report.converted,1);assert.equal(report.collected,13000)
 db.run('UPDATE sesion SET account_id=2')
 assert.equal((await finance.costs()).length,0);assert.equal((await finance.payments(invoice.id)).length,0)
 assert.equal((await finance.overview('2026-09-01','2026-09-30')).billed,0)
 await assert.rejects(()=>finance.addPayment({id:'foreign',invoice_id:invoice.id,amount_cents:100,paid_on:'2026-09-16',note:''}))
 await assert.rejects(()=>finance.saveCost({description:'Foreign',project:'',document_id:invoice.id,category:'cost',stage:'actual',incurred_on:'2026-09-16',quantity_milli:1000,unit_price_cents:10,supplier:'',notes:''}))
 await finance.removePayment('p1')
 db.run('UPDATE sesion SET account_id=1')
 assert.equal((await invoices.getFull(invoice.id)).paid_cents,3000)
 const customer = await clients.upsertByName({name:'Original client', email:'old@example.test'})
 const historic = await invoices.save({...draft, client:{...customer}, status:'draft'})
 await clients.update(customer.id,{...customer,name:'Renamed client',email:'new@example.test',phone:'555',address:'New address',tax_id:'TEST'})
 assert.equal((await clients.getById(customer.id)).name,'Renamed client')
 assert.equal((await invoices.getFull(historic.id)).client_name,'Original client','catalog edits preserve historical snapshots')
 const emitted = await invoices.save({...draft,id:historic.id,number:historic.number,client:{id:customer.id,name:'Original client',email:'old@example.test'}})
 assert.equal(emitted.client_id,customer.id,'renaming keeps document linked by identity')
 assert.equal(await clients.getByName('Original client'),null,'issuing an old draft must not recreate the old customer')
 const fresh = await clients.getById(customer.id)
 const edited = await invoices.save({...draft,id:historic.id,number:emitted.number,client:fresh})
 assert.equal(edited.client_email,'new@example.test','explicit editor update changes current document snapshot')
 const other = await clients.upsertByName({name:'Other client'})
 await assert.rejects(()=>clients.update(customer.id,{...fresh,name:other.name}),/Ya existe/)
 db.run('UPDATE sesion SET account_id=2')
 await assert.rejects(()=>clients.update(customer.id,{...fresh,name:'Wrong account'}),/no está disponible/)
 db.run('UPDATE sesion SET account_id=1')
 assert.equal((await clients.getById(customer.id)).name,'Renamed client')
 assert.deepEqual(query('PRAGMA foreign_key_check'),[])
 console.log('PASS: migration, partial payments, overpayment, retry deduplication, rollback, selective conversion, totals, costs, metrics, account isolation, customer edits and stable identity')
} finally { await server.close();db.close();delete globalThis.__financeDb }
