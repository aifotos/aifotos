import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient.js";
import { Pencil, History, TrendingUp, TrendingDown, Minus, ArrowLeftRight, Gift } from "lucide-react";

const TIPOS = [
  { value: "debito", label: "Débito", icon: "💳" },
  { value: "credito", label: "Crédito", icon: "🏦" },
  { value: "ahorro", label: "Ahorro / Inversión", icon: "📈" },
];

const fmt = (n) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);

const fmtFecha = (dateStr) =>
  new Date(dateStr + "T00:00:00").toLocaleDateString("es-DO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function Modal({ open, onClose, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className={`bg-gray-900 border border-gray-800 rounded-2xl w-full ${
          wide ? "max-w-lg" : "max-w-md"
        } p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

function CuentaCard({ cuenta, gastado, valorActual, variacion, balanceCredito, esBalanceManual, onEdit, onHistorial, onCashback }) {
  const esCredito = cuenta.tipo === "credito";
  const esAhorro = cuenta.tipo === "ahorro";
  const esEfectivo = cuenta.tipo === "efectivo";
  const limite = Number(cuenta.limite_credito) || 0;
  const balanceOwed = balanceCredito || 0;
  const disponible = esCredito ? limite - balanceOwed : valorActual;
  const porcentajeUsado = esCredito && limite > 0 ? (balanceOwed / limite) * 100 : 0;

  const barColor =
    porcentajeUsado > 80 ? "bg-red-500" : porcentajeUsado > 50 ? "bg-amber-500" : "bg-emerald-500";

  const icon = esCredito ? "🏦" : esAhorro ? "📈" : esEfectivo ? "💵" : "💳";
  const label = esCredito ? "Crédito" : esAhorro ? "Ahorro / Inversión" : esEfectivo ? "Efectivo" : "Débito";

  return (
    <div
      className={`bg-gray-900 border rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-700 transition-colors ${
        esAhorro ? "border-amber-900/40" : "border-gray-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <p className="text-white font-semibold text-sm">{cuenta.nombre}</p>
            <p className="text-gray-500 text-xs uppercase tracking-wider">{label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {esAhorro && (
            <span className="text-[11px] text-amber-500/80 bg-amber-500/10 px-2 py-1 rounded-full">
              No cuenta en ingresos
            </span>
          )}
          {esCredito && cuenta.dia_corte && (
            <span className="text-[11px] text-gray-600 bg-gray-800 px-2 py-1 rounded-full">
              Corte: {cuenta.dia_corte} · Pago: {cuenta.dia_pago}
            </span>
          )}
          {esCredito && esBalanceManual && (
            <span className="text-[11px] text-blue-400/80 bg-blue-500/10 px-2 py-1 rounded-full">
              Balance manual
            </span>
          )}
          {esAhorro && (
            <button
              onClick={() => onHistorial(cuenta)}
              className="text-gray-500 hover:text-amber-400 transition p-1 rounded-lg hover:bg-gray-800"
              title="Ver historial / actualizar"
            >
              <History size={14} />
            </button>
          )}
          {esCredito && (
            <button
              onClick={() => onCashback(cuenta)}
              className="text-gray-500 hover:text-green-400 transition p-1 rounded-lg hover:bg-gray-800"
              title="Registrar cashback"
            >
              <Gift size={14} />
            </button>
          )}
          {!esEfectivo && (
            <button
              onClick={() => onEdit(cuenta)}
              className="text-gray-500 hover:text-emerald-400 transition p-1 rounded-lg hover:bg-gray-800"
              title="Editar cuenta"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {esCredito ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Gastado este mes</span>
            <span>{fmt(gastado)}</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(porcentajeUsado, 100)}%` }}
            />
          </div>
          <div className="flex justify-between">
            <div>
              <p className="text-[11px] text-gray-500">
                Balance actual{esBalanceManual ? " (ajustado)" : ""}
              </p>
              <p className="text-lg font-bold text-red-400">{fmt(balanceOwed)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-500">Disponible</p>
              <p className="text-lg font-bold text-white">{fmt(Math.max(0, disponible))}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-gray-500">Límite</p>
            <p className="text-sm text-gray-400">{fmt(limite)}</p>
          </div>
        </div>
      ) : esAhorro ? (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] text-gray-500">Valor actual del fondo</p>
            <p className="text-2xl font-bold text-amber-400">{fmt(valorActual)}</p>
          </div>
          {variacion !== null && (
            <VariacionBadge variacion={variacion} />
          )}
        </div>
      ) : (
        <div>
          <p className="text-[11px] text-gray-500">Balance actual</p>
          <p className="text-2xl font-bold text-white">{fmt(valorActual)}</p>
        </div>
      )}
    </div>
  );
}

function VariacionBadge({ variacion }) {
  if (variacion === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
        <Minus size={11} /> Sin cambio
      </span>
    );
  }
  const positivo = variacion > 0;
  return (
    <span
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
        positivo ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
      }`}
    >
      {positivo ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {positivo ? "+" : ""}
      {variacion.toFixed(2)}%
    </span>
  );
}

function HistorialModal({ cuenta, historial, onAddEntry }) {
  const hoy = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ fecha: hoy, valor: "", notas: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.valor) return;
    setSaving(true);
    await onAddEntry(cuenta.id, form);
    setForm({ fecha: hoy, valor: "", notas: "" });
    setSaving(false);
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">📈</span>
        <div>
          <h3 className="text-lg font-bold text-white">{cuenta.nombre}</h3>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Historial del fondo</p>
        </div>
      </div>

      {/* Formulario nueva entrada */}
      <div className="bg-gray-800/60 rounded-xl p-4 mb-5 space-y-3">
        <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">
          Registrar nuevo valor
        </p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Fecha</label>
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Valor (RD$)</label>
            <input
              type="number"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              placeholder="0.00"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Notas (opcional)</label>
          <input
            type="text"
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            placeholder="Ej: Rendimiento mensual, reinversión..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500 transition"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.valor}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2 rounded-xl text-sm transition"
        >
          {saving ? "Guardando..." : "Guardar entrada"}
        </button>
      </div>

      {/* Lista de historial */}
      {historial.length === 0 ? (
        <p className="text-center text-gray-600 text-sm py-4">
          Aún no hay entradas en el historial.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
            Historial ({historial.length} entradas)
          </p>
          {historial.map((entry, i) => {
            const anterior = historial[i + 1];
            let delta = null;
            if (anterior) {
              delta = ((entry.valor - anterior.valor) / anterior.valor) * 100;
            }
            const esUltimo = i === 0;
            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                  esUltimo
                    ? "bg-amber-500/10 border border-amber-500/20"
                    : "bg-gray-800/40"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white tabular-nums">
                      {fmt(entry.valor)}
                    </p>
                    {delta !== null && <VariacionBadge variacion={delta} />}
                    {esUltimo && (
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                        actual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fmtFecha(entry.fecha)}
                    {entry.notas && (
                      <span className="text-gray-600"> · {entry.notas}</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function Cuentas() {
  const { perfil } = useAuth();
  const [cuentas, setCuentas] = useState([]);
  const [gastosPorCuenta, setGastosPorCuenta] = useState({});
  const [movimientosPorCuenta, setMovimientosPorCuenta] = useState({});
  const [historialPorCuenta, setHistorialPorCuenta] = useState({});
  const [pagosOrigenPorCuenta, setPagosOrigenPorCuenta] = useState({});
  const [pagosDestinoPorCuenta, setPagosDestinoPorCuenta] = useState({});
  const [cashbackPorCuenta, setCashbackPorCuenta] = useState({});
  const [cashbackModal, setCashbackModal] = useState(null);
  const [cashbackForm, setCashbackForm] = useState({ monto: "", fecha: new Date().toISOString().split("T")[0], notas: "" });
  const [cashbackSaving, setCashbackSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal crear
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    tipo: "debito",
    balance_inicial: "",
    limite_credito: "",
    dia_corte: "",
    dia_pago: "",
  });

  // Modal editar
  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Modal historial ahorro
  const [cuentaHistorial, setCuentaHistorial] = useState(null);

  // Modal transferencia
  const [transferModal, setTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ origen_id: "", destino_id: "", monto: "", notas: "" });
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState(null);

  // Error global (ej. auto-crear efectivo)
  const [error, setError] = useState(null);

  const fetchCuentas = async () => {
    const { data } = await supabase
      .from("cuentas")
      .select("*")
      .eq("perfil_id", perfil.id)
      .order("created_at", { ascending: true });

    let cuentasData = data || [];

    // Auto-crear cuenta Efectivo si no existe
    if (!cuentasData.some(c => c.tipo === "efectivo")) {
      const { data: nueva, error: efectivoError } = await supabase.from("cuentas").insert({
        perfil_id: perfil.id,
        nombre: "Efectivo",
        tipo: "efectivo",
        balance_inicial: 0,
      }).select().single();
      if (nueva) {
        cuentasData = [nueva, ...cuentasData];
      } else if (efectivoError) {
        console.error("Error creando cuenta Efectivo:", efectivoError.message);
        setError(`No se pudo crear la cuenta Efectivo: ${efectivoError.message}. Puede que necesites correr en Supabase: ALTER TABLE cuentas DROP CONSTRAINT cuentas_tipo_check; ALTER TABLE cuentas ADD CONSTRAINT cuentas_tipo_check CHECK (tipo IN ('debito', 'credito', 'ahorro', 'efectivo'));`);
      }
    }

    setCuentas(cuentasData);

    const hoy = new Date();
    const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const finMesStr = `${finMes.getFullYear()}-${String(finMes.getMonth() + 1).padStart(2, "0")}-${String(finMes.getDate()).padStart(2, "0")}`;

    const creditoIds = cuentasData.filter((c) => c.tipo === "credito").map((c) => c.id);
    if (creditoIds.length > 0) {
      const { data: txns } = await supabase
        .from("transacciones")
        .select("cuenta_id, monto")
        .eq("perfil_id", perfil.id)
        .in("cuenta_id", creditoIds)
        .gte("fecha", inicioMes)
        .lte("fecha", finMesStr);

      const gastos = {};
      (txns || []).forEach((t) => {
        gastos[t.cuenta_id] = (gastos[t.cuenta_id] || 0) + Math.abs(Number(t.monto));
      });
      setGastosPorCuenta(gastos);
    }

    // Movimientos totales por cuenta (para calcular balance real)
    if (cuentasData.length > 0) {
      const { data: allTxns } = await supabase
        .from("transacciones")
        .select("cuenta_id, monto, categorias(tipo)")
        .eq("perfil_id", perfil.id)
        .in("cuenta_id", cuentasData.map((c) => c.id));
      const movs = {};
      (allTxns || []).forEach((t) => {
        if (!movs[t.cuenta_id]) movs[t.cuenta_id] = { ingresos: 0, gastos: 0 };
        if (t.categorias?.tipo === "ingreso") movs[t.cuenta_id].ingresos += Number(t.monto);
        else if (t.categorias?.tipo === "gasto") movs[t.cuenta_id].gastos += Number(t.monto);
      });
      setMovimientosPorCuenta(movs);
    }

    // Pagos a tarjeta (para ajustar balances de cuentas origen y destino)
    const { data: pagosTarjeta } = await supabase
      .from("pagos_tarjeta")
      .select("cuenta_origen_id, cuenta_destino_id, monto")
      .eq("perfil_id", perfil.id);

    const pagosOrigen = {};
    const pagosDestino = {};
    (pagosTarjeta || []).forEach((p) => {
      pagosOrigen[p.cuenta_origen_id] = (pagosOrigen[p.cuenta_origen_id] || 0) + Number(p.monto);
      pagosDestino[p.cuenta_destino_id] = (pagosDestino[p.cuenta_destino_id] || 0) + Number(p.monto);
    });
    setPagosOrigenPorCuenta(pagosOrigen);
    setPagosDestinoPorCuenta(pagosDestino);

    // Cashback por tarjeta de crédito
    const creditoIdsAll = cuentasData.filter((c) => c.tipo === "credito").map((c) => c.id);
    if (creditoIdsAll.length > 0) {
      const { data: cashbacks } = await supabase
        .from("cashback_tarjeta")
        .select("cuenta_id, monto")
        .eq("perfil_id", perfil.id)
        .in("cuenta_id", creditoIdsAll);
      const cbPorCuenta = {};
      (cashbacks || []).forEach((cb) => {
        cbPorCuenta[cb.cuenta_id] = (cbPorCuenta[cb.cuenta_id] || 0) + Number(cb.monto);
      });
      setCashbackPorCuenta(cbPorCuenta);
    }

    // Historial para cuentas de ahorro
    const ahorroIds = cuentasData.filter((c) => c.tipo === "ahorro").map((c) => c.id);
    if (ahorroIds.length > 0) {
      const { data: hist } = await supabase
        .from("historial_fondo")
        .select("*")
        .eq("perfil_id", perfil.id)
        .in("cuenta_id", ahorroIds)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });

      const porCuenta = {};
      (hist || []).forEach((h) => {
        if (!porCuenta[h.cuenta_id]) porCuenta[h.cuenta_id] = [];
        porCuenta[h.cuenta_id].push(h);
      });
      setHistorialPorCuenta(porCuenta);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (perfil?.id) fetchCuentas();
  }, [perfil]);

  const handleAddHistorialEntry = async (cuentaId, { fecha, valor, notas }) => {
    const valorNum = Number(valor);
    await supabase.from("historial_fondo").insert({
      perfil_id: perfil.id,
      cuenta_id: cuentaId,
      fecha,
      valor: valorNum,
      notas: notas?.trim() || null,
    });
    // Sincronizar balance_inicial con el último valor para que el Dashboard lo refleje
    await supabase.from("cuentas").update({ balance_inicial: valorNum }).eq("id", cuentaId);
    await fetchCuentas();
  };

  const handleCashback = async () => {
    if (!cashbackForm.monto || !cashbackModal) return;
    setCashbackSaving(true);
    await supabase.from("cashback_tarjeta").insert({
      perfil_id: perfil.id,
      cuenta_id: cashbackModal.id,
      monto: parseFloat(cashbackForm.monto),
      fecha: cashbackForm.fecha,
      notas: cashbackForm.notas?.trim() || null,
    });
    setCashbackModal(null);
    setCashbackSaving(false);
    fetchCuentas();
  };

  const handleOpenEdit = (cuenta) => {
    setEditando(cuenta);
    // Para débito y efectivo, mostrar el balance real calculado (balance_inicial + ingresos - gastos)
    // para que el usuario corrija directamente el valor que ve en el banco
    const movs = movimientosPorCuenta[cuenta.id] || { ingresos: 0, gastos: 0 };
    const balanceActual =
      cuenta.tipo === "debito" || cuenta.tipo === "efectivo"
        ? Number(cuenta.balance_inicial) + movs.ingresos - movs.gastos
        : Number(cuenta.balance_inicial) ?? 0;
    setEditForm({
      nombre: cuenta.nombre,
      balance_inicial:
        cuenta.tipo === "debito" || cuenta.tipo === "ahorro" || cuenta.tipo === "efectivo"
          ? String(balanceActual)
          : "",
      limite_credito: cuenta.tipo === "credito" ? String(cuenta.limite_credito ?? "") : "",
      dia_corte: cuenta.dia_corte ? String(cuenta.dia_corte) : "",
      dia_pago: cuenta.dia_pago ? String(cuenta.dia_pago) : "",
      balance_manual:
        cuenta.tipo === "credito" && cuenta.balance_manual !== null && cuenta.balance_manual !== undefined
          ? String(cuenta.balance_manual)
          : "",
    });
  };

  const handleUpdate = async () => {
    if (!editForm.nombre?.trim()) return;
    setEditSaving(true);

    // Para débito y efectivo el usuario ingresa el balance actual real,
    // así que back-calculamos balance_inicial = valor_ingresado - ingresos + gastos
    const movs = movimientosPorCuenta[editando.id] || { ingresos: 0, gastos: 0 };
    const balanceIngresado = Number(editForm.balance_inicial) || 0;
    const balanceInicialCalculado =
      editando.tipo === "debito" || editando.tipo === "efectivo"
        ? balanceIngresado - movs.ingresos + movs.gastos
        : balanceIngresado;

    const payload = {
      nombre: editForm.nombre.trim(),
      balance_inicial:
        editando.tipo === "debito" || editando.tipo === "ahorro" || editando.tipo === "efectivo"
          ? balanceInicialCalculado
          : 0,
      limite_credito: editando.tipo === "credito" ? Number(editForm.limite_credito) || 0 : 0,
      dia_corte:
        editando.tipo === "credito" && editForm.dia_corte ? Number(editForm.dia_corte) : null,
      dia_pago:
        editando.tipo === "credito" && editForm.dia_pago ? Number(editForm.dia_pago) : null,
      balance_manual:
        editando.tipo === "credito" && editForm.balance_manual !== ""
          ? Number(editForm.balance_manual)
          : null,
    };

    await supabase.from("cuentas").update(payload).eq("id", editando.id);
    setEditando(null);
    setEditSaving(false);
    fetchCuentas();
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);

    const payload = {
      perfil_id: perfil.id,
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      balance_inicial:
        form.tipo === "debito" || form.tipo === "ahorro"
          ? Number(form.balance_inicial) || 0
          : 0,
      limite_credito: form.tipo === "credito" ? Number(form.limite_credito) || 0 : 0,
      dia_corte: form.tipo === "credito" && form.dia_corte ? Number(form.dia_corte) : null,
      dia_pago: form.tipo === "credito" && form.dia_pago ? Number(form.dia_pago) : null,
    };

    const { data: nueva } = await supabase.from("cuentas").insert(payload).select().single();

    // Si es ahorro con valor inicial, crear primera entrada en el historial
    if (form.tipo === "ahorro" && Number(form.balance_inicial) > 0 && nueva) {
      const hoy = new Date().toISOString().split("T")[0];
      await supabase.from("historial_fondo").insert({
        perfil_id: perfil.id,
        cuenta_id: nueva.id,
        fecha: hoy,
        valor: Number(form.balance_inicial),
        notas: "Valor inicial",
      });
    }

    setForm({ nombre: "", tipo: "debito", balance_inicial: "", limite_credito: "", dia_corte: "", dia_pago: "" });
    setModalOpen(false);
    setSaving(false);
    fetchCuentas();
  };

  // Transferencia entre cuentas
  const handleTransfer = async () => {
    if (!transferForm.origen_id || !transferForm.destino_id || !transferForm.monto) return;
    if (transferForm.origen_id === transferForm.destino_id) return;
    const monto = parseFloat(transferForm.monto);
    if (isNaN(monto) || monto <= 0) return;

    setTransferSaving(true);
    setTransferError(null);

    const origen = cuentas.find(c => c.id === transferForm.origen_id);
    const destino = cuentas.find(c => c.id === transferForm.destino_id);

    const { error: err1 } = await supabase
      .from("cuentas")
      .update({ balance_inicial: Number(origen.balance_inicial) - monto })
      .eq("id", origen.id);

    if (err1) { setTransferError(err1.message); setTransferSaving(false); return; }

    const { error: err2 } = await supabase
      .from("cuentas")
      .update({ balance_inicial: Number(destino.balance_inicial) + monto })
      .eq("id", destino.id);

    if (err2) { setTransferError(err2.message); setTransferSaving(false); return; }

    setTransferForm({ origen_id: "", destino_id: "", monto: "", notas: "" });
    setTransferModal(false);
    setTransferSaving(false);
    fetchCuentas();
  };

  // Valor actual y variación para cuentas de ahorro
  const getAhorroInfo = (cuenta) => {
    if (cuenta.tipo !== "ahorro") return { valor: Number(cuenta.balance_inicial) || 0, variacion: null };
    const hist = historialPorCuenta[cuenta.id] || [];
    if (hist.length === 0) return { valor: Number(cuenta.balance_inicial) || 0, variacion: null };
    const ultimo = hist[0];
    const anterior = hist[1];
    const variacion = anterior
      ? ((ultimo.valor - anterior.valor) / anterior.valor) * 100
      : null;
    return { valor: Number(ultimo.valor), variacion };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Cargando cuentas...</p>
      </div>
    );
  }

  const cuentasOrdenadas = [...cuentas].sort((a, b) => {
    if (a.tipo === "efectivo") return -1;
    if (b.tipo === "efectivo") return 1;
    return 0;
  });

  const cuentasTransferibles = cuentas.filter(c => c.tipo === "debito" || c.tipo === "efectivo");

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-sm text-red-300">
          <p className="font-semibold mb-1">Error al inicializar cuenta Efectivo</p>
          <p className="text-red-400 mb-2">{error}</p>
          <p className="text-xs text-gray-400">Corre este SQL en Supabase → SQL Editor:</p>
          <pre className="mt-1 bg-gray-900 rounded p-2 text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap">
{`ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS cuentas_tipo_check;
ALTER TABLE cuentas ADD CONSTRAINT cuentas_tipo_check
  CHECK (tipo IN ('debito', 'credito', 'ahorro', 'efectivo'));`}
          </pre>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Cuentas</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTransferModal(true)}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-3 py-2 rounded-xl transition"
          >
            <ArrowLeftRight size={14} />
            Transferir
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            + Nueva cuenta
          </button>
        </div>
      </div>

      {cuentas.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg mb-2">No tienes cuentas registradas</p>
          <p className="text-gray-600 text-sm">Agrega tu primera cuenta para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cuentasOrdenadas.map((c) => {
            const { valor, variacion } = getAhorroInfo(c);
            const movs = movimientosPorCuenta[c.id] || { ingresos: 0, gastos: 0 };
            const pagosSalientes = pagosOrigenPorCuenta[c.id] || 0;
            const pagosRecibidos = pagosDestinoPorCuenta[c.id] || 0;
            const cashbackTotal = cashbackPorCuenta[c.id] || 0;
            const valorReal = (c.tipo === "debito" || c.tipo === "efectivo")
              ? Number(c.balance_inicial) + movs.ingresos - movs.gastos - pagosSalientes
              : valor;
            const balanceCreditoCalculado = Math.max(0, movs.gastos - movs.ingresos - pagosRecibidos - cashbackTotal);
            const esBalanceManual = c.balance_manual !== null && c.balance_manual !== undefined;
            const balanceCredito = esBalanceManual ? Number(c.balance_manual) : balanceCreditoCalculado;
            return (
              <CuentaCard
                key={c.id}
                cuenta={c}
                gastado={gastosPorCuenta[c.id] || 0}
                valorActual={valorReal}
                variacion={variacion}
                balanceCredito={balanceCredito}
                esBalanceManual={esBalanceManual}
                onEdit={handleOpenEdit}
                onHistorial={setCuentaHistorial}
                onCashback={(cuenta) => {
                  setCashbackModal(cuenta);
                  setCashbackForm({ monto: "", fecha: new Date().toISOString().split("T")[0], notas: "" });
                }}
              />
            );
          })}
        </div>
      )}

      {/* Modal crear nueva cuenta */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <h3 className="text-lg font-bold text-white mb-5">Nueva cuenta</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Banreservas, Fondo Popular"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-2 block">Tipo</label>
            <div className="flex gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setForm({ ...form, tipo: t.value })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
                    form.tipo === t.value
                      ? "bg-emerald-600/20 border border-emerald-600 text-emerald-400"
                      : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {(form.tipo === "debito" || form.tipo === "ahorro") && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                {form.tipo === "ahorro" ? "Valor inicial del fondo" : "Balance inicial"}
              </label>
              <input
                type="number"
                value={form.balance_inicial}
                onChange={(e) => setForm({ ...form, balance_inicial: e.target.value })}
                placeholder="0.00"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
              />
              {form.tipo === "ahorro" && (
                <p className="text-xs text-amber-600/70 mt-1">
                  Se registrará como primera entrada en el historial.
                </p>
              )}
            </div>
          )}

          {form.tipo === "credito" && (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Límite de crédito</label>
                <input
                  type="number"
                  value={form.limite_credito}
                  onChange={(e) => setForm({ ...form, limite_credito: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 mb-1 block">Día de corte</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.dia_corte}
                    onChange={(e) => setForm({ ...form, dia_corte: e.target.value })}
                    placeholder="15"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 mb-1 block">Día de pago</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.dia_pago}
                    onChange={(e) => setForm({ ...form, dia_pago: e.target.value })}
                    placeholder="5"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
                  />
                </div>
              </div>
            </>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || !form.nombre.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition mt-2"
          >
            {saving ? "Guardando..." : "Guardar cuenta"}
          </button>
        </div>
      </Modal>

      {/* Modal editar cuenta */}
      <Modal open={!!editando} onClose={() => setEditando(null)}>
        <h3 className="text-lg font-bold text-white mb-5">Editar cuenta</h3>
        {editando && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre</label>
              <input
                type="text"
                value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-600 transition"
              />
            </div>

            {(editando.tipo === "debito" || editando.tipo === "ahorro" || editando.tipo === "efectivo") && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  {editando.tipo === "ahorro" ? "Valor de referencia (RD$)" : "Balance actual (RD$)"}
                </label>
                <input
                  type="number"
                  value={editForm.balance_inicial}
                  onChange={(e) => setEditForm({ ...editForm, balance_inicial: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
                />
                {editando.tipo === "ahorro" && (
                  <p className="text-xs text-gray-600 mt-1">
                    Para actualizar el valor del fondo usa el botón del historial 📋
                  </p>
                )}
              </div>
            )}

            {editando.tipo === "credito" && (
              <>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Límite de crédito (RD$)</label>
                  <input
                    type="number"
                    value={editForm.limite_credito}
                    onChange={(e) => setEditForm({ ...editForm, limite_credito: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Día de corte</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={editForm.dia_corte}
                      onChange={(e) => setEditForm({ ...editForm, dia_corte: e.target.value })}
                      placeholder="15"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Día de pago</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={editForm.dia_pago}
                      onChange={(e) => setEditForm({ ...editForm, dia_pago: e.target.value })}
                      placeholder="5"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
                    />
                  </div>
                </div>
                <div className="border-t border-gray-800 pt-4">
                  <label className="text-xs text-gray-400 mb-1 block">
                    Balance manual (RD$)
                  </label>
                  <p className="text-xs text-gray-600 mb-2">
                    Opcional. Si lo defines, reemplaza el balance calculado automáticamente.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      value={editForm.balance_manual}
                      onChange={(e) => setEditForm({ ...editForm, balance_manual: e.target.value })}
                      placeholder="0.00"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
                    />
                    {editForm.balance_manual !== "" && (
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, balance_manual: "" })}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-xl transition"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            <button
              onClick={handleUpdate}
              disabled={editSaving || !editForm.nombre?.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition mt-2"
            >
              {editSaving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </Modal>

      {/* Modal historial fondo de ahorro */}
      <Modal open={!!cuentaHistorial} onClose={() => setCuentaHistorial(null)} wide>
        {cuentaHistorial && (
          <HistorialModal
            cuenta={cuentaHistorial}
            historial={historialPorCuenta[cuentaHistorial.id] || []}
            onAddEntry={handleAddHistorialEntry}
          />
        )}
      </Modal>

      {/* Modal cashback */}
      <Modal open={!!cashbackModal} onClose={() => setCashbackModal(null)}>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl">💰</span>
          <div>
            <h3 className="text-lg font-bold text-white">Registrar cashback</h3>
            <p className="text-xs text-gray-500">{cashbackModal?.nombre}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Monto (RD$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cashbackForm.monto}
              onChange={(e) => setCashbackForm({ ...cashbackForm, monto: e.target.value })}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500 transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Fecha</label>
            <input
              type="date"
              value={cashbackForm.fecha}
              onChange={(e) => setCashbackForm({ ...cashbackForm, fecha: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Notas (opcional)</label>
            <input
              type="text"
              value={cashbackForm.notas}
              onChange={(e) => setCashbackForm({ ...cashbackForm, notas: e.target.value })}
              placeholder="Ej: Cashback de enero"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500 transition"
            />
          </div>
          <button
            onClick={handleCashback}
            disabled={cashbackSaving || !cashbackForm.monto}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition"
          >
            {cashbackSaving ? "Guardando..." : "Registrar cashback"}
          </button>
        </div>
      </Modal>

      {/* Modal transferencia */}
      <Modal open={transferModal} onClose={() => { setTransferModal(false); setTransferError(null); setTransferForm({ origen_id: "", destino_id: "", monto: "", notas: "" }); }}>
        <h3 className="text-lg font-bold text-white mb-5">Transferir fondos</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Desde</label>
            <select
              value={transferForm.origen_id}
              onChange={(e) => setTransferForm({ ...transferForm, origen_id: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-600 transition appearance-none"
            >
              <option value="">Seleccionar cuenta origen...</option>
              {cuentasTransferibles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.tipo === "efectivo" ? "💵" : "💳"} {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Hacia</label>
            <select
              value={transferForm.destino_id}
              onChange={(e) => setTransferForm({ ...transferForm, destino_id: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-600 transition appearance-none"
            >
              <option value="">Seleccionar cuenta destino...</option>
              {cuentasTransferibles
                .filter(c => c.id !== transferForm.origen_id)
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.tipo === "efectivo" ? "💵" : "💳"} {c.nombre}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Monto (RD$)</label>
            <input
              type="number"
              value={transferForm.monto}
              onChange={(e) => setTransferForm({ ...transferForm, monto: e.target.value })}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Notas (opcional)</label>
            <input
              type="text"
              value={transferForm.notas}
              onChange={(e) => setTransferForm({ ...transferForm, notas: e.target.value })}
              placeholder="Ej: Retiro para gastos del fin de semana"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
            />
          </div>
          {transferError && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
              <p className="text-red-400 text-xs font-semibold">Error al transferir</p>
              <p className="text-red-300 text-xs font-mono break-all mt-1">{transferError}</p>
            </div>
          )}
          <button
            onClick={handleTransfer}
            disabled={transferSaving || !transferForm.origen_id || !transferForm.destino_id || !transferForm.monto}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition mt-2"
          >
            {transferSaving ? "Transfiriendo..." : "Confirmar transferencia"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
