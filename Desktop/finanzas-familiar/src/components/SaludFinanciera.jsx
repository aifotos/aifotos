import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext'
import { Loader2, TrendingUp, Shield, PiggyBank, CheckSquare, AlertTriangle, XCircle, Info } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n) =>
  Number(n).toLocaleString('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

function healthColor(status) {
  if (status === 'green') return 'text-emerald-400'
  if (status === 'yellow') return 'text-yellow-400'
  return 'text-red-400'
}

function healthBg(status) {
  if (status === 'green') return 'bg-emerald-500/10 border-emerald-500/20'
  if (status === 'yellow') return 'bg-yellow-500/10 border-yellow-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

function healthIcon(status) {
  if (status === 'green') return CheckSquare
  if (status === 'yellow') return AlertTriangle
  return XCircle
}

function savingsStatus(rate) {
  if (rate >= 30) return 'green'
  if (rate >= 10) return 'yellow'
  return 'red'
}

function coverageStatus(months) {
  if (months >= 3) return 'green'
  if (months >= 1) return 'yellow'
  return 'red'
}

function adherenceStatus(pct) {
  if (pct >= 80) return 'green'
  if (pct >= 60) return 'yellow'
  return 'red'
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-gray-300 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-gray-400">{entry.name}:</span>
          <span className="font-medium text-white">
            {entry.name === 'Tasa de ahorro' ? `${entry.value}%` : fmt(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SaludFinanciera() {
  const { perfil } = useAuth()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState(null)
  const [monthlyData, setMonthlyData] = useState([])

  useEffect(() => {
    if (!perfil?.id) return
    fetchData()
  }, [perfil?.id])

  async function fetchData() {
    setLoading(true)

    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      .toISOString().split('T')[0]
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0]
    const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString().split('T')[0]

    // Fetch in parallel
    const [
      { data: txns6m },
      { data: allTxns },
      { data: cuentas },
      { data: prestamos },
      { data: presupuestos },
      { data: txMes },
    ] = await Promise.all([
      supabase
        .from('transacciones')
        .select('fecha, monto, cuenta_id, categorias(tipo)')
        .eq('perfil_id', perfil.id)
        .gte('fecha', sixMonthsAgo)
        .order('fecha', { ascending: true }),
      supabase
        .from('transacciones')
        .select('cuenta_id, monto, categorias(tipo)')
        .eq('perfil_id', perfil.id),
      supabase
        .from('cuentas')
        .select('*')
        .eq('perfil_id', perfil.id),
      supabase
        .from('prestamos')
        .select('monto_total, pagado')
        .eq('perfil_id', perfil.id),
      supabase
        .from('presupuestos')
        .select('categoria_id, monto_limite')
        .eq('perfil_id', perfil.id),
      supabase
        .from('transacciones')
        .select('categoria_id, monto, categorias(tipo)')
        .eq('perfil_id', perfil.id)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes),
    ])

    // ── Monthly data ──────────────────────────────────────────────────────
    const byMonth = {}
    ;(txns6m || []).forEach((t) => {
      const key = t.fecha.substring(0, 7)
      if (!byMonth[key]) byMonth[key] = { ingresos: 0, gastos: 0 }
      const tipo = t.categorias?.tipo
      if (tipo === 'ingreso') byMonth[key].ingresos += Number(t.monto)
      else if (tipo === 'gasto') byMonth[key].gastos += Number(t.monto)
    })

    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-DO', { month: 'short', year: '2-digit' })
      const data = byMonth[key] || { ingresos: 0, gastos: 0 }
      const balance = data.ingresos - data.gastos
      const tasaAhorro = data.ingresos > 0 ? Math.round((balance / data.ingresos) * 100) : 0
      months.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1), ...data, balance, tasaAhorro })
    }
    setMonthlyData(months)

    // ── Net worth ─────────────────────────────────────────────────────────
    const movs = {}
    ;(allTxns || []).forEach((t) => {
      if (!movs[t.cuenta_id]) movs[t.cuenta_id] = { ingresos: 0, gastos: 0 }
      const tipo = t.categorias?.tipo
      if (tipo === 'ingreso') movs[t.cuenta_id].ingresos += Number(t.monto)
      else if (tipo === 'gasto') movs[t.cuenta_id].gastos += Number(t.monto)
    })

    let activos = 0
    let deudaCredito = 0
    ;(cuentas || []).forEach((c) => {
      const m = movs[c.id] || { ingresos: 0, gastos: 0 }
      if (c.tipo === 'debito' || c.tipo === 'ahorro') {
        activos += Number(c.balance_inicial) + m.ingresos - m.gastos
      } else if (c.tipo === 'credito') {
        deudaCredito += Math.max(0, m.gastos - m.ingresos)
      }
    })

    const deudaPrestamos = (prestamos || []).reduce((sum, p) => {
      return sum + Math.max(0, Number(p.monto_total) - Number(p.pagado || 0))
    }, 0)

    const patrimonioNeto = activos - deudaCredito - deudaPrestamos

    // ── Ahorro balance (real) ─────────────────────────────────────────────
    const ahorroBalance = (cuentas || [])
      .filter((c) => c.tipo === 'ahorro')
      .reduce((sum, c) => {
        const m = movs[c.id] || { ingresos: 0, gastos: 0 }
        return sum + Number(c.balance_inicial) + m.ingresos - m.gastos
      }, 0)

    // ── Savings rate: % of liquid assets in savings ───────────────────────
    // Uses account balances (not just monthly flow) so balance_inicial counts
    const tasaAhorroActual = activos > 0 ? Math.round((ahorroBalance / activos) * 100) : 0

    const last3 = months.slice(-3)
    const avgGastos = last3.length > 0
      ? last3.reduce((s, m) => s + m.gastos, 0) / last3.length
      : 0
    const coberturaEmergencia = avgGastos > 0 ? ahorroBalance / avgGastos : 0

    // ── Budget adherence ──────────────────────────────────────────────────
    const gastoPorCat = {}
    ;(txMes || []).forEach((t) => {
      if (t.categorias?.tipo === 'gasto') {
        gastoPorCat[t.categoria_id] = (gastoPorCat[t.categoria_id] || 0) + Number(t.monto)
      }
    })

    const presupuestosDetalle = (presupuestos || []).map((p) => ({
      ...p,
      gastado: gastoPorCat[p.categoria_id] || 0,
      enRango: (gastoPorCat[p.categoria_id] || 0) <= Number(p.monto_limite),
    }))

    const adherencia =
      presupuestosDetalle.length > 0
        ? Math.round(
            (presupuestosDetalle.filter((p) => p.enRango).length /
              presupuestosDetalle.length) *
              100
          )
        : 100

    setMetrics({
      patrimonioNeto,
      tasaAhorroActual,
      coberturaEmergencia: Math.round(coberturaEmergencia * 10) / 10,
      adherencia,
      activos,
      deudaCredito,
      deudaPrestamos,
    })

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    )
  }

  const sStatus = savingsStatus(metrics.tasaAhorroActual)
  const cStatus = coverageStatus(metrics.coberturaEmergencia)
  const aStatus = adherenceStatus(metrics.adherencia)
  const pStatus = metrics.patrimonioNeto >= 0 ? 'green' : 'red'

  const consejos = buildConsejos(metrics, sStatus, cStatus, aStatus)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Salud Financiera</h1>
        <p className="text-sm text-gray-500 mt-1">
          Resumen de indicadores clave · últimos 6 meses
        </p>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Patrimonio neto"
          value={fmt(metrics.patrimonioNeto)}
          sub={`Activos ${fmt(metrics.activos)} · Deudas ${fmt(metrics.deudaCredito + metrics.deudaPrestamos)}`}
          icon={TrendingUp}
          status={pStatus}
        />
        <MetricCard
          label="Activos en ahorro"
          value={`${metrics.tasaAhorroActual}%`}
          sub={
            sStatus === 'green'
              ? 'Excelente — más del 30% de activos en ahorro'
              : sStatus === 'yellow'
              ? 'Regular — intenta llegar al 30% en ahorro'
              : 'Bajo — menos del 10% de activos en ahorro'
          }
          icon={PiggyBank}
          status={sStatus}
        />
        <MetricCard
          label="Cobertura de emergencia"
          value={`${metrics.coberturaEmergencia} mes${metrics.coberturaEmergencia !== 1 ? 'es' : ''}`}
          sub={
            cStatus === 'green'
              ? 'Bien — tienes más de 3 meses cubiertos'
              : cStatus === 'yellow'
              ? 'Regular — meta: 3 meses de gastos'
              : 'Crítico — prioriza un fondo de emergencia'
          }
          icon={Shield}
          status={cStatus}
        />
        <MetricCard
          label="Adherencia al presupuesto"
          value={`${metrics.adherencia}%`}
          sub={
            aStatus === 'green'
              ? 'Cumpliendo el presupuesto'
              : aStatus === 'yellow'
              ? 'Algunas categorías sobre el límite'
              : 'Varias categorías fuera de presupuesto'
          }
          icon={CheckSquare}
          status={aStatus}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Ingresos vs Gastos */}
        <ChartCard title="Ingresos vs Gastos" subtitle="Últimos 6 meses">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} barCategoryGap="30%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 12 }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Balance mensual */}
        <ChartCard title="Balance mensual" subtitle="Diferencia ingresos − gastos">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
              <Bar dataKey="balance" name="Balance" radius={[4, 4, 0, 0]}>
                {monthlyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.balance >= 0 ? '#10b981' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tasa de ahorro histórica */}
      <ChartCard title="Tasa de ahorro" subtitle="Porcentaje del ingreso que se ahorra cada mes">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={20} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'Meta 20%', fill: '#10b981', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
            <Line
              type="monotone"
              dataKey="tasaAhorro"
              name="Tasa de ahorro"
              stroke="#818cf8"
              strokeWidth={2}
              dot={{ fill: '#818cf8', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Consejos */}
      {consejos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Acciones recomendadas</h2>
          <div className="space-y-3">
            {consejos.map((c, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-start gap-3"
              >
                <Info size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-300">{c}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon: Icon, status }) {
  const StatusIcon = healthIcon(status)
  return (
    <div className={`bg-gray-900 border rounded-xl p-5 ${healthBg(status)}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</span>
        <div className="flex items-center gap-1.5">
          <StatusIcon size={14} className={healthColor(status)} />
          <Icon size={14} className="text-gray-600" />
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums mb-1 ${healthColor(status)}`}>{value}</p>
      <p className="text-xs text-gray-500 leading-snug">{sub}</p>
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-sm font-semibold text-white mb-0.5">{title}</p>
      <p className="text-xs text-gray-500 mb-4">{subtitle}</p>
      {children}
    </div>
  )
}

// ─── Consejos ─────────────────────────────────────────────────────────────────

function buildConsejos(metrics, sStatus, cStatus, aStatus) {
  const tips = []

  if (sStatus === 'red') {
    tips.push('Menos del 10% de tus activos líquidos están en ahorro. Intenta destinar una parte fija de tus ingresos a una cuenta de ahorro cada mes, aunque sea pequeña.')
  } else if (sStatus === 'yellow') {
    tips.push('Entre el 10% y 30% de tus activos están en ahorro. Trata de incrementar gradualmente esa proporción para tener mayor respaldo ante imprevistos.')
  }

  if (cStatus === 'red') {
    tips.push('No tienes suficiente fondo de emergencia. La meta mínima son 3 meses de tus gastos promedio en una cuenta de ahorro separada. Prioriza esto antes de otras metas.')
  } else if (cStatus === 'yellow') {
    tips.push(`Tienes ${metrics.coberturaEmergencia} ${metrics.coberturaEmergencia === 1 ? 'mes' : 'meses'} de emergencia cubiertos. Apunta a llegar a 3 meses antes de incrementar otros gastos.`)
  }

  if (aStatus === 'red') {
    tips.push('Varias categorías de tu presupuesto están excedidas este mes. Revisa el módulo de Presupuesto para identificar cuáles y ajusta tus hábitos de gasto antes de que termine el mes.')
  } else if (aStatus === 'yellow') {
    tips.push('Algunas categorías están cerca o por encima del límite. Mantén un ojo en ellas el resto del mes para no salirte del presupuesto.')
  }

  if (metrics.patrimonioNeto < 0) {
    tips.push('Tu patrimonio neto es negativo, lo que significa que tus deudas superan tus activos. Enfócate en pagar las deudas con mayor interés primero (tarjetas de crédito antes que préstamos).')
  }

  if (tips.length === 0) {
    tips.push('¡Excelentes indicadores! Mantén la disciplina y considera incrementar tu meta de ahorro o diversificar tus inversiones para seguir creciendo.')
  }

  return tips
}
