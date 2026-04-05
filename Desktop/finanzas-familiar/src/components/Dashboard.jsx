import { useState, useEffect } from 'react'
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from '../context/AuthContext'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

export default function Dashboard() {
  const { perfil } = useAuth()
  const [resumen, setResumen] = useState({ ingresos: 0, gastos: 0 })
  const [transacciones, setTransacciones] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [prestamos, setPrestamos] = useState([])
  const [presupuestos, setPresupuestos] = useState([])
  const [categoriasConPago, setCategoriasConPago] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!perfil?.id) return
    fetchData()
  }, [perfil?.id])

  async function fetchData() {
    setLoading(true)

    const now = new Date()
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0]
    const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0]
    const mesKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const [
      { data: txMes },
      { data: cuentasData },
      { data: todasTx },
      { data: txMesCuenta },
      { data: ultimas },
      { data: prestamosData },
      { data: presupuestosData },
    ] = await Promise.all([
      supabase
        .from('transacciones')
        .select('cuenta_id, monto, categoria_id, categorias(tipo)')
        .eq('perfil_id', perfil.id)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes),
      supabase
        .from('cuentas')
        .select('*')
        .eq('perfil_id', perfil.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('transacciones')
        .select('cuenta_id, monto, categorias(tipo)')
        .eq('perfil_id', perfil.id),
      supabase
        .from('transacciones')
        .select('cuenta_id, monto')
        .eq('perfil_id', perfil.id)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes),
      supabase
        .from('transacciones')
        .select('id, monto, fecha, notas, categorias(nombre, icono, tipo), cuentas(nombre)')
        .eq('perfil_id', perfil.id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('prestamos')
        .select('id, nombre, cuota_mensual, monto_restante, dia_pago')
        .eq('perfil_id', perfil.id),
      supabase
        .from('presupuestos')
        .select('id, monto_limite, dia_pago, categoria_id, categorias(nombre, icono)')
        .eq('perfil_id', perfil.id)
        .eq('mes', mesKey),
    ])

    const ahorroIds = new Set((cuentasData || []).filter(c => c.tipo === 'ahorro').map(c => c.id))

    let ingresosTransacciones = 0
    let gastos = 0
    ;(txMes || []).forEach((t) => {
      if (ahorroIds.has(t.cuenta_id)) return
      const tipo = t.categorias?.tipo
      if (tipo === 'ingreso') ingresosTransacciones += Number(t.monto)
      else if (tipo === 'gasto') gastos += Number(t.monto)
    })

    const balanceDebito = (cuentasData || [])
      .filter((c) => c.tipo === 'debito')
      .reduce((sum, c) => sum + Number(c.balance_inicial || 0), 0)

    const ingresos = ingresosTransacciones + balanceDebito
    setResumen({ ingresos, gastos })

    const movimientosPorCuenta = {}
    ;(todasTx || []).forEach((t) => {
      const id = t.cuenta_id
      if (!movimientosPorCuenta[id]) movimientosPorCuenta[id] = { ingresos: 0, gastos: 0 }
      const tipo = t.categorias?.tipo
      if (tipo === 'ingreso') movimientosPorCuenta[id].ingresos += Number(t.monto)
      else if (tipo === 'gasto') movimientosPorCuenta[id].gastos += Number(t.monto)
    })

    const gastosMesPorCuenta = {}
    ;(txMesCuenta || []).forEach((t) => {
      const id = t.cuenta_id
      gastosMesPorCuenta[id] = (gastosMesPorCuenta[id] || 0) + Math.abs(Number(t.monto))
    })

    const cuentasConBalance = (cuentasData || []).map((c) => {
      const mov = movimientosPorCuenta[c.id] || { ingresos: 0, gastos: 0 }
      if (c.tipo === 'debito' || c.tipo === 'ahorro' || c.tipo === 'efectivo') {
        const balanceReal = Number(c.balance_inicial) + mov.ingresos - mov.gastos
        return { ...c, balanceReal }
      } else {
        const gastadoMes = gastosMesPorCuenta[c.id] || 0
        const disponible = Number(c.limite_credito) - gastadoMes
        return { ...c, balanceReal: disponible, gastadoMes }
      }
    })

    // Set de categoria_ids que ya tienen al menos una transacción este mes
    const pagados = new Set((txMes || []).map(t => t.categoria_id).filter(Boolean))

    setCuentas(cuentasConBalance)
    setPrestamos((prestamosData || []).filter(p => Number(p.monto_restante) > 0))
    setPresupuestos(presupuestosData || [])
    setCategoriasConPago(pagados)
    setTransacciones(ultimas || [])
    setLoading(false)
  }

  const balance = resumen.ingresos - resumen.gastos
  const mesActual = new Date().toLocaleDateString('es-DO', {
    month: 'long',
    year: 'numeric',
  })

  const fmt = (n) =>
    Number(n).toLocaleString('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">{mesActual}</p>
      </div>

      {/* Cards resumen del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Ingresos"
          value={fmt(resumen.ingresos)}
          icon={TrendingUp}
          color="emerald"
        />
        <SummaryCard
          label="Gastos del mes"
          value={fmt(resumen.gastos)}
          icon={TrendingDown}
          color="red"
        />
        <SummaryCard
          label="Balance"
          value={fmt(balance)}
          icon={Wallet}
          color={balance >= 0 ? 'emerald' : 'red'}
        />
      </div>

      {/* Total en cuentas */}
      {cuentas.filter(c => c.tipo !== 'credito').length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
              Total en cuentas
            </p>
            <p className="text-2xl font-bold tabular-nums text-white">
              {fmt(cuentas.filter(c => c.tipo !== 'credito').reduce((s, c) => s + c.balanceReal, 0))}
            </p>
          </div>
          <Wallet size={24} className="text-gray-600" />
        </div>
      )}

      {/* Liquidez por quincena */}
      <QuincenaLiquidez
        cuentas={cuentas}
        prestamos={prestamos}
        presupuestos={presupuestos}
        categoriasConPago={categoriasConPago}
        fmt={fmt}
      />

      {/* Últimas transacciones */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          Últimas transacciones
        </h2>

        {transacciones.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
            No hay transacciones registradas.
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800 overflow-hidden">
            {transacciones.map((tx) => {
              const esIngreso = tx.categorias?.tipo === 'ingreso'
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-4 py-3 sm:px-5 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0">
                      {tx.categorias?.icono || '📦'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">
                        {tx.categorias?.nombre || 'Sin categoría'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {tx.cuentas?.nombre} · {tx.notas || 'Sin nota'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
                    {esIngreso ? (
                      <ArrowUpRight size={14} className="text-emerald-400" />
                    ) : (
                      <ArrowDownRight size={14} className="text-red-400" />
                    )}
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        esIngreso ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {fmt(tx.monto)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Quincena Liquidez Section ───────────────────────────────────────────────

function QuincenaLiquidez({ cuentas, prestamos, presupuestos, categoriasConPago, fmt }) {
  const now = new Date()
  const dayOfMonth = now.getDate()
  const currentQ = dayOfMonth <= 15 ? 1 : 2

  // Liquid balance = débito accounts only (not ahorro, not crédito)
  const liquidBalance = cuentas
    .filter(c => c.tipo === 'debito' || c.tipo === 'efectivo')
    .reduce((s, c) => s + c.balanceReal, 0)

  // Credit cards grouped by quincena of their dia_pago
  const tarjetasQ1 = cuentas.filter(c => c.tipo === 'credito' && c.dia_pago >= 1 && c.dia_pago <= 15)
  const tarjetasQ2 = cuentas.filter(c => c.tipo === 'credito' && c.dia_pago >= 16 && c.dia_pago <= 31)
  const tarjetasSinFecha = cuentas.filter(c => c.tipo === 'credito' && !c.dia_pago)

  // Loans grouped by quincena of their dia_pago
  const prestamosQ1 = prestamos.filter(p => p.dia_pago >= 1 && p.dia_pago <= 15)
  const prestamosQ2 = prestamos.filter(p => p.dia_pago >= 16 && p.dia_pago <= 31)
  const prestamosSinFecha = prestamos.filter(p => !p.dia_pago)

  // Presupuestos grouped by quincena of their dia_pago
  const presupuestosQ1 = presupuestos.filter(p => p.dia_pago >= 1 && p.dia_pago <= 15)
  const presupuestosQ2 = presupuestos.filter(p => p.dia_pago >= 16 && p.dia_pago <= 31)
  const presupuestosSinFecha = presupuestos.filter(p => !p.dia_pago)

  // Totals per quincena
  const totalQ1 =
    tarjetasQ1.reduce((s, c) => s + (c.gastadoMes || 0), 0) +
    prestamosQ1.reduce((s, p) => s + Number(p.cuota_mensual), 0) +
    presupuestosQ1.reduce((s, p) => s + Number(p.monto_limite), 0)

  const totalQ2 =
    tarjetasQ2.reduce((s, c) => s + (c.gastadoMes || 0), 0) +
    prestamosQ2.reduce((s, p) => s + Number(p.cuota_mensual), 0) +
    presupuestosQ2.reduce((s, p) => s + Number(p.monto_limite), 0)

  const totalSinFecha =
    tarjetasSinFecha.reduce((s, c) => s + (c.gastadoMes || 0), 0) +
    prestamosSinFecha.reduce((s, p) => s + Number(p.cuota_mensual), 0) +
    presupuestosSinFecha.reduce((s, p) => s + Number(p.monto_limite), 0)

  const totalMes = totalQ1 + totalQ2 + totalSinFecha

  // Liquidity status
  function coverageStatus(available, needed) {
    if (needed === 0) return 'ok'
    const ratio = available / needed
    if (ratio >= 1.2) return 'ok'
    if (ratio >= 1.0) return 'tight'
    return 'deficit'
  }

  const q1Status = coverageStatus(liquidBalance, totalQ1)
  // After Q1 payments, what's left for Q2?
  const balanceAfterQ1 = liquidBalance - totalQ1
  const q2Status = coverageStatus(balanceAfterQ1, totalQ2)
  const overallStatus = coverageStatus(liquidBalance, totalMes)

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthName = now.toLocaleDateString('es-DO', { month: 'long' })

  const hasSomething = totalMes > 0 || prestamosSinFecha.length > 0 || tarjetasSinFecha.length > 0 || presupuestosSinFecha.length > 0

  if (!hasSomething) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Liquidez por quincena</h2>
        <LiquidityBadge status={overallStatus} />
      </div>

      {/* Balance disponible banner */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">
            Balance líquido disponible (débito)
          </p>
          <p className={`text-2xl font-bold tabular-nums ${liquidBalance >= totalMes ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(liquidBalance)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-0.5">Total compromisos mes</p>
          <p className="text-lg font-semibold text-amber-400 tabular-nums">{fmt(totalMes)}</p>
        </div>
      </div>

      {/* Quincena cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <QuincenaCard
          label="Primera quincena"
          range={`1–15 de ${monthName}`}
          isCurrent={currentQ === 1}
          tarjetas={tarjetasQ1}
          prestamosItems={prestamosQ1}
          presupuestosItems={presupuestosQ1}
          total={totalQ1}
          availableBalance={liquidBalance}
          categoriasConPago={categoriasConPago}
          fmt={fmt}
        />
        <QuincenaCard
          label="Segunda quincena"
          range={`16–${lastDay} de ${monthName}`}
          isCurrent={currentQ === 2}
          tarjetas={tarjetasQ2}
          prestamosItems={prestamosQ2}
          presupuestosItems={presupuestosQ2}
          total={totalQ2}
          availableBalance={balanceAfterQ1}
          categoriasConPago={categoriasConPago}
          fmt={fmt}
        />
      </div>

      {/* Items sin fecha definida */}
      {(prestamosSinFecha.length > 0 || tarjetasSinFecha.length > 0 || presupuestosSinFecha.length > 0) && (
        <div className="bg-gray-900 border border-amber-900/40 rounded-xl p-4 mb-4">
          <p className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-3">
            Sin fecha de pago definida
          </p>
          <div className="space-y-2">
            {prestamosSinFecha.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">🏦 {p.nombre}</span>
                <span className="text-amber-400 font-medium tabular-nums">{fmt(p.cuota_mensual)}</span>
              </div>
            ))}
            {tarjetasSinFecha.map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">💳 {c.nombre}</span>
                <span className="text-amber-400 font-medium tabular-nums">{fmt(c.gastadoMes || 0)}</span>
              </div>
            ))}
            {presupuestosSinFecha.map(p => {
              const pagado = categoriasConPago?.has(p.categoria_id)
              return (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className={`flex items-center gap-1.5 ${pagado ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                    {pagado && <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />}
                    {p.categorias?.icono || '📦'} {p.categorias?.nombre || 'Sin categoría'}
                  </span>
                  <span className={`font-medium tabular-nums ${pagado ? 'line-through text-gray-600' : 'text-amber-400'}`}>{fmt(p.monto_limite)}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Asigna un día de pago en Préstamos, Tarjetas o Presupuestos para incluirlos en el análisis quincenal.
          </p>
        </div>
      )}
    </section>
  )
}

function QuincenaCard({ label, range, isCurrent, tarjetas, prestamosItems, presupuestosItems, total, availableBalance, categoriasConPago, fmt }) {
  function status() {
    if (total === 0) return 'ok'
    const ratio = availableBalance / total
    if (ratio >= 1.2) return 'ok'
    if (ratio >= 1.0) return 'tight'
    return 'deficit'
  }

  const s = status()
  const deficit = total - availableBalance
  const hasItems = tarjetas.length > 0 || prestamosItems.length > 0 || presupuestosItems.length > 0

  const borderColor = s === 'ok' ? 'border-gray-800' : s === 'tight' ? 'border-amber-800/50' : 'border-red-800/50'

  return (
    <div className={`bg-gray-900 border ${borderColor} rounded-xl p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{label}</p>
            {isCurrent && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
                Actual
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{range}</p>
        </div>
        <LiquidityBadge status={s} small />
      </div>

      {/* Items */}
      {hasItems ? (
        <div className="space-y-1.5">
          {prestamosItems.map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span className="text-gray-400 flex items-center gap-1.5">
                <span className="text-gray-600">🏦</span>
                {p.nombre}
                <span className="text-gray-600">· día {p.dia_pago}</span>
              </span>
              <span className="text-white font-medium tabular-nums">{fmt(p.cuota_mensual)}</span>
            </div>
          ))}
          {tarjetas.map(c => (
            <div key={c.id} className="flex items-center justify-between text-xs">
              <span className="text-gray-400 flex items-center gap-1.5">
                <span className="text-gray-600">💳</span>
                {c.nombre}
                <span className="text-gray-600">· pago día {c.dia_pago}</span>
              </span>
              <span className="text-white font-medium tabular-nums">{fmt(c.gastadoMes || 0)}</span>
            </div>
          ))}
          {presupuestosItems.map(p => {
            const pagado = categoriasConPago?.has(p.categoria_id)
            return (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className={`flex items-center gap-1.5 ${pagado ? 'text-gray-600 line-through' : 'text-gray-400'}`}>
                  {pagado
                    ? <CheckCircle2 size={10} className="text-emerald-500 flex-shrink-0" />
                    : <span className="text-gray-600">{p.categorias?.icono || '📦'}</span>
                  }
                  {p.categorias?.nombre || 'Sin categoría'}
                  <span className="text-gray-600">· día {p.dia_pago}</span>
                </span>
                <span className={`font-medium tabular-nums ${pagado ? 'text-gray-600 line-through' : 'text-white'}`}>
                  {fmt(p.monto_limite)}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-600 py-1">Sin pagos programados.</p>
      )}

      {/* Total & coverage */}
      <div className="pt-2 border-t border-gray-800 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Total pagos</span>
          <span className="text-white font-semibold tabular-nums">{fmt(total)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Balance disponible</span>
          <span className={`tabular-nums font-medium ${availableBalance >= total ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(availableBalance)}
          </span>
        </div>
        {s === 'deficit' && (
          <div className="flex items-center gap-1.5 mt-2 bg-red-500/10 border border-red-800/40 rounded-lg px-3 py-2">
            <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">
              Faltan <span className="font-semibold">{fmt(deficit)}</span> — necesitas más ingresos en cuenta.
            </p>
          </div>
        )}
        {s === 'tight' && (
          <div className="flex items-center gap-1.5 mt-2 bg-amber-500/10 border border-amber-800/40 rounded-lg px-3 py-2">
            <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">
              Apenas cubre — margen menor al 20%.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function LiquidityBadge({ status, small }) {
  if (status === 'ok') {
    return (
      <span className={`flex items-center gap-1 bg-emerald-500/10 text-emerald-400 rounded-full font-medium ${small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'}`}>
        <CheckCircle2 size={small ? 10 : 12} />
        Cubierto
      </span>
    )
  }
  if (status === 'tight') {
    return (
      <span className={`flex items-center gap-1 bg-amber-500/10 text-amber-400 rounded-full font-medium ${small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'}`}>
        <AlertTriangle size={small ? 10 : 12} />
        Ajustado
      </span>
    )
  }
  return (
    <span className={`flex items-center gap-1 bg-red-500/10 text-red-400 rounded-full font-medium ${small ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'}`}>
      <XCircle size={small ? 10 : 12} />
      Déficit
    </span>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon: Icon, color }) {
  const colorMap = {
    emerald: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      icon: 'text-emerald-400',
    },
    red: {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      icon: 'text-red-400',
    },
  }
  const c = colorMap[color] || colorMap.emerald

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
          {label}
        </span>
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <Icon size={16} className={c.icon} />
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${c.text}`}>{value}</p>
    </div>
  )
}
