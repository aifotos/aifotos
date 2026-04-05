import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { Plus, X, Loader2, Trash2, Pencil } from "lucide-react";

const EMPTY_PAGO_FORM = {
  cuenta_id: "",
  capital: "",
  interes: "",
  fecha: new Date().toISOString().split("T")[0],
  notas: "",
};

const fmt = (n) =>
  Number(n).toLocaleString("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const INPUT_CLS =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500";

const EMPTY_FORM = {
  nombre: "",
  monto_total: "",
  monto_restante: "",
  tasa_interes: "",
  cuota_mensual: "",
  dia_pago: "",
  fecha_inicio: new Date().toISOString().split("T")[0],
  notas: "",
};

export default function Prestamos() {
  const { perfil } = useAuth();
  const [prestamos, setPrestamos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editModal, setEditModal] = useState(null);   // prestamo being edited
  const [deleteModal, setDeleteModal] = useState(null); // prestamo to delete
  const [pagoModal, setPagoModal] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [pagoForm, setPagoForm] = useState(EMPTY_PAGO_FORM);
  const [cuentas, setCuentas] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [amortizacionCount, setAmortizacionCount] = useState({});

  useEffect(() => {
    if (perfil?.id) {
      fetchPrestamos();
      fetchCuentas();
    }
  }, [perfil?.id]);

  async function fetchCuentas() {
    const { data } = await supabase
      .from("cuentas")
      .select("id, nombre, tipo")
      .eq("perfil_id", perfil.id)
      .order("created_at", { ascending: true });
    setCuentas(data || []);
  }

  async function fetchPrestamos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("prestamos")
      .select("*")
      .eq("perfil_id", perfil.id)
      .order("created_at", { ascending: false });

    if (error) {
      setDbError(error.message);
    } else {
      setPrestamos(data || []);
      setDbError(null);
      // Fetch amortization row counts per loan
      const { data: amoCounts } = await supabase
        .from("amortizacion_prestamo")
        .select("prestamo_id")
        .eq("perfil_id", perfil.id);
      const countMap = {};
      (amoCounts || []).forEach((r) => {
        countMap[r.prestamo_id] = (countMap[r.prestamo_id] || 0) + 1;
      });
      setAmortizacionCount(countMap);
    }
    setLoading(false);
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre || !form.monto_total || !form.cuota_mensual) return;
    setSaving(true);
    setSaveError(null);

    const montoTotal = parseFloat(form.monto_total);
    const montoRestante =
      form.monto_restante !== "" ? parseFloat(form.monto_restante) : montoTotal;

    const payload = {
      perfil_id: perfil.id,
      nombre: form.nombre.trim(),
      monto_total: montoTotal,
      monto_restante: montoRestante,
      tasa_interes: parseFloat(form.tasa_interes) || 0,
      cuota_mensual: parseFloat(form.cuota_mensual),
      fecha_inicio: form.fecha_inicio,
      notas: form.notas.trim() || null,
    };
    if (form.dia_pago) payload.dia_pago = parseInt(form.dia_pago);

    const { error } = await supabase.from("prestamos").insert(payload);

    if (error) {
      setSaveError(error.message);
    } else {
      setModalOpen(false);
      setForm(EMPTY_FORM);
      fetchPrestamos();
    }
    setSaving(false);
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  function openEdit(p) {
    setEditForm({
      nombre: p.nombre || "",
      monto_total: String(p.monto_total || ""),
      monto_restante: String(p.monto_restante || ""),
      tasa_interes: String(p.tasa_interes || ""),
      cuota_mensual: String(p.cuota_mensual || ""),
      dia_pago: p.dia_pago ? String(p.dia_pago) : "",
      fecha_inicio: p.fecha_inicio || new Date().toISOString().split("T")[0],
      notas: p.notas || "",
    });
    setEditModal(p);
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editModal) return;
    setSaving(true);
    setSaveError(null);

    const payload = {
      nombre: editForm.nombre.trim(),
      monto_total: parseFloat(editForm.monto_total),
      monto_restante: parseFloat(editForm.monto_restante),
      tasa_interes: parseFloat(editForm.tasa_interes) || 0,
      cuota_mensual: parseFloat(editForm.cuota_mensual),
      fecha_inicio: editForm.fecha_inicio,
      notas: editForm.notas.trim() || null,
    };
    if (editForm.dia_pago) payload.dia_pago = parseInt(editForm.dia_pago);

    const { error } = await supabase
      .from("prestamos")
      .update(payload)
      .eq("id", editModal.id);

    if (error) {
      setSaveError(error.message);
    } else {
      setEditModal(null);
      fetchPrestamos();
    }
    setSaving(false);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteModal) return;
    setSaving(true);
    await supabase.from("prestamos").delete().eq("id", deleteModal.id);
    setPrestamos((prev) => prev.filter((p) => p.id !== deleteModal.id));
    setDeleteModal(null);
    setSaving(false);
  }

  // ── Payment ─────────────────────────────────────────────────────────────────
  async function handlePago(e) {
    e.preventDefault();
    if (!pagoModal || !pagoForm.capital || !pagoForm.cuenta_id) return;
    setSaving(true);

    const capital = parseFloat(pagoForm.capital) || 0;
    const interes = parseFloat(pagoForm.interes) || 0;
    const totalPago = capital + interes;

    // 1. Reducir saldo del préstamo solo por capital
    const nuevoRestante = Math.max(0, Number(pagoModal.monto_restante) - capital);
    const { error: errPrestamo } = await supabase
      .from("prestamos")
      .update({ monto_restante: nuevoRestante })
      .eq("id", pagoModal.id);

    if (errPrestamo) { setSaving(false); return; }

    // 2. Registrar el pago en tabla pagos_prestamo (descuenta de la cuenta origen)
    await supabase.from("pagos_prestamo").insert({
      perfil_id: perfil.id,
      prestamo_id: pagoModal.id,
      cuenta_id: pagoForm.cuenta_id,
      capital,
      interes,
      monto_total: totalPago,
      fecha: pagoForm.fecha,
      notas: pagoForm.notas?.trim() || null,
    });

    setPagoModal(null);
    setPagoForm(EMPTY_PAGO_FORM);
    fetchPrestamos();
    setSaving(false);
  }

  // ── Open payment modal (fetches amortization table if available) ─────────────
  async function openPagoModal(p) {
    setSaving(true);

    let cuotaData = null;

    // If amortization table exists, find the cuota closest to today by date
    if (amortizacionCount[p.id]) {
      const today = new Date().toISOString().split("T")[0];

      // First try: next upcoming payment (fecha >= today)
      const { data: upcoming } = await supabase
        .from("amortizacion_prestamo")
        .select("num_cuota, capital, interes, fecha, valor_cuota")
        .eq("prestamo_id", p.id)
        .gte("fecha", today)
        .order("fecha", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (upcoming) {
        cuotaData = upcoming;
      } else {
        // Fallback: all dates passed — use the last cuota
        const { data: last } = await supabase
          .from("amortizacion_prestamo")
          .select("num_cuota, capital, interes, fecha, valor_cuota")
          .eq("prestamo_id", p.id)
          .order("fecha", { ascending: false })
          .limit(1)
          .maybeSingle();
        cuotaData = last;
      }
    }

    let capitalVal, interesVal, fromTable = false;
    if (cuotaData) {
      capitalVal = Number(cuotaData.capital).toFixed(2);
      interesVal = Number(cuotaData.interes).toFixed(2);
      fromTable = true;
    } else {
      const tasaMensual = Number(p.tasa_interes) / 12 / 100;
      const i = Number(p.monto_restante) * tasaMensual;
      const c = Math.max(0, Number(p.cuota_mensual) - i);
      capitalVal = c.toFixed(2);
      interesVal = i.toFixed(2);
    }

    setPagoModal({ ...p, _nextCuota: cuotaData?.num_cuota ?? null, _fromTable: fromTable });
    setPagoForm({
      ...EMPTY_PAGO_FORM,
      capital: capitalVal,
      interes: interesVal,
      fecha: cuotaData?.fecha || new Date().toISOString().split("T")[0],
    });
    setSaving(false);
  }

  // ── CSV upload for amortization table ────────────────────────────────────────
  async function handleCSVUpload(file, prestamo) {
    if (!file) return;

    const text = await file.text();
    const lines = text.trim().split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      alert("El archivo está vacío o no tiene datos.");
      return;
    }

    const headers = lines[0].split(",").map((h) =>
      h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z_]/g, "")
    );

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(",");
      const row = {};
      headers.forEach((h, j) => (row[h] = vals[j]?.trim()));
      const parsed = {
        perfil_id: perfil.id,
        prestamo_id: prestamo.id,
        num_cuota: parseInt(row.num_cuota ?? row.cuota ?? row.numero ?? i),
        fecha: row.fecha || null,
        valor_cuota: parseFloat(row.valor_cuota) || null,
        capital: parseFloat(row.capital),
        interes: parseFloat(row.interes),
        saldo_capital: parseFloat(row.saldo_capital) || null,
      };
      if (!isNaN(parsed.num_cuota) && !isNaN(parsed.capital) && !isNaN(parsed.interes)) {
        rows.push(parsed);
      }
    }

    if (rows.length === 0) {
      alert("No se encontraron filas válidas.\n\nEl CSV debe tener columnas:\nnum_cuota, fecha, valor_cuota, capital, interes, saldo_capital");
      return;
    }

    await supabase.from("amortizacion_prestamo").delete().eq("prestamo_id", prestamo.id);
    const { error } = await supabase.from("amortizacion_prestamo").insert(rows);

    if (error) {
      alert("Error al cargar la tabla: " + error.message);
    } else {
      alert(`✓ ${rows.length} cuotas cargadas para "${prestamo.nombre}"`);
      fetchPrestamos(); // refresh count
    }
    setCsvUploadId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Préstamos</h1>
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
          <p className="text-red-400 font-semibold mb-1">
            Tabla "prestamos" no encontrada en la base de datos
          </p>
          <p className="text-gray-400 text-sm mb-4">
            Debes crear la tabla en Supabase. Ve a tu proyecto en Supabase →
            SQL Editor y ejecuta este código:
          </p>
          <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap">
            {`CREATE TABLE prestamos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  monto_total NUMERIC NOT NULL,
  monto_restante NUMERIC NOT NULL,
  tasa_interes NUMERIC DEFAULT 0,
  cuota_mensual NUMERIC NOT NULL,
  dia_pago SMALLINT,
  fecha_inicio DATE NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Si la tabla ya existe, agrega la columna con:
-- ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS dia_pago SMALLINT;

ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden gestionar sus préstamos"
ON prestamos FOR ALL
USING (
  perfil_id IN (
    SELECT id FROM perfiles WHERE user_id = auth.uid()
  )
);`}
          </pre>
          <button
            onClick={fetchPrestamos}
            className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Préstamos</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nuevo préstamo
        </button>
      </div>

      {/* Banner migración dia_pago */}
      <MigracionBanner prestamos={prestamos} />

      {/* Resumen */}
      {prestamos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total adeudado</p>
            <p className="text-lg font-bold text-red-400">
              {fmt(prestamos.reduce((s, p) => s + Number(p.monto_restante), 0))}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Cuotas mensuales</p>
            <p className="text-lg font-bold text-amber-400">
              {fmt(
                prestamos
                  .filter((p) => p.monto_restante > 0)
                  .reduce((s, p) => s + Number(p.cuota_mensual), 0)
              )}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Préstamos activos</p>
            <p className="text-lg font-bold text-white">
              {prestamos.filter((p) => p.monto_restante > 0).length}
            </p>
          </div>
        </div>
      )}

      {/* Lista */}
      {prestamos.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <span className="text-4xl block mb-3">🏦</span>
          <p className="text-gray-400 font-medium">No tienes préstamos registrados</p>
          <p className="text-gray-600 text-sm mt-1">
            Agrega un préstamo para hacer seguimiento de tus pagos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prestamos.map((p) => {
            const pagado = Number(p.monto_total) - Number(p.monto_restante);
            const pct =
              Number(p.monto_total) > 0
                ? (pagado / Number(p.monto_total)) * 100
                : 0;
            const terminado = Number(p.monto_restante) <= 0;

            return (
              <div
                key={p.id}
                className={`bg-gray-900 border rounded-2xl p-5 space-y-4 ${
                  terminado ? "border-emerald-800/50" : "border-gray-800"
                }`}
              >
                {/* Nombre y acciones */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white font-semibold">{p.nombre}</p>
                    {p.notas && (
                      <p className="text-gray-500 text-xs mt-0.5">{p.notas}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {terminado && (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                        Pagado
                      </span>
                    )}
                    <button
                      onClick={() => openEdit(p)}
                      className="text-gray-600 hover:text-emerald-400 transition-colors p-1"
                      title="Editar préstamo"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteModal(p)}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Pagado: {fmt(pagado)}</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Restante: {fmt(p.monto_restante)}</span>
                    <span>Total: {fmt(p.monto_total)}</span>
                  </div>
                </div>

                {/* Detalles */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-800 rounded-lg px-3 py-2">
                    <p className="text-gray-500 text-xs">Cuota mensual</p>
                    <p className="text-white font-medium text-sm">
                      {fmt(p.cuota_mensual)}
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-lg px-3 py-2">
                    <p className="text-gray-500 text-xs">Día de pago</p>
                    <p className={`font-medium text-sm ${p.dia_pago ? "text-white" : "text-gray-600"}`}>
                      {p.dia_pago ? `Día ${p.dia_pago}` : "—"}
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-lg px-3 py-2">
                    <p className="text-gray-500 text-xs">Interés anual</p>
                    <p className="text-white font-medium text-sm">
                      {Number(p.tasa_interes) > 0 ? `${p.tasa_interes}%` : "—"}
                    </p>
                  </div>
                </div>

                {/* Botones pago + CSV */}
                {!terminado && (
                  <div className="space-y-2">
                    <button
                      onClick={() => openPagoModal(p)}
                      disabled={saving}
                      className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-400 text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      {saving ? "Cargando..." : "Registrar pago"}
                    </button>

                    {/* Tabla de amortización */}
                    {amortizacionCount[p.id] ? (
                      <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                        <span className="text-blue-400 text-xs">
                          📊 Tabla cargada — {amortizacionCount[p.id]} cuotas
                        </span>
                        <label className="text-blue-400 text-xs underline cursor-pointer hover:text-blue-300">
                          Reemplazar
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                              handleCSVUpload(e.target.files[0], p);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2.5 space-y-1.5">
                        <p className="text-gray-500 text-xs">
                          Carga la tabla de amortización del banco para usar valores exactos en cada pago.
                        </p>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                            📎 Subir tabla (.csv)
                            <input
                              type="file"
                              accept=".csv"
                              className="hidden"
                              onChange={(e) => {
                                handleCSVUpload(e.target.files[0], p);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <a
                            href="/bhd_amortizacion.csv"
                            download="plantilla_amortizacion.csv"
                            className="text-xs text-emerald-500 hover:text-emerald-400 underline"
                          >
                            Descargar plantilla
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal nuevo préstamo ──────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setModalOpen(false); setSaveError(null); }} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Nuevo préstamo</h2>
              <button onClick={() => { setModalOpen(false); setSaveError(null); }} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            {saveError && <ErrorBox message={saveError} />}
            <PrestamoForm
              form={form}
              setForm={setForm}
              onSubmit={handleSubmit}
              saving={saving}
              label="Guardar préstamo"
            />
          </div>
        </div>
      )}

      {/* ── Modal editar préstamo ─────────────────────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setEditModal(null); setSaveError(null); }} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Editar préstamo</h2>
              <button onClick={() => { setEditModal(null); setSaveError(null); }} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            {saveError && <ErrorBox message={saveError} />}
            <PrestamoForm
              form={editForm}
              setForm={setEditForm}
              onSubmit={handleEdit}
              saving={saving}
              label="Guardar cambios"
              isEdit
            />
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminación ───────────────────────────────────────── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteModal(null)} />
          <div className="relative bg-gray-900 border border-red-800/50 rounded-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Eliminar préstamo</h2>
              <button onClick={() => setDeleteModal(null)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-white font-medium">{deleteModal.nombre}</p>
              <p className="text-gray-400 text-sm">
                Saldo restante: {fmt(deleteModal.monto_restante)}
              </p>
            </div>
            <p className="text-gray-400 text-sm">
              Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar este préstamo?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal registrar pago ──────────────────────────────────────────────── */}
      {pagoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setPagoModal(null); setPagoForm(EMPTY_PAGO_FORM); }} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Registrar pago</h2>
              <button onClick={() => { setPagoModal(null); setPagoForm(EMPTY_PAGO_FORM); }} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Info préstamo */}
            <div className="bg-gray-800 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-white font-medium">{pagoModal.nombre}</p>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                  Cuota #{pagoModal._nextCuota}
                </span>
              </div>
              <p className="text-gray-400 text-sm">Saldo restante: {fmt(pagoModal.monto_restante)}</p>
              {pagoModal._fromTable ? (
                <p className="text-blue-400 text-xs">✓ Valores del banco (tabla de amortización real)</p>
              ) : (
                <p className="text-gray-500 text-xs">Calculado con fórmula — sube un CSV para usar valores exactos del banco</p>
              )}
            </div>

            <form onSubmit={handlePago} className="space-y-4">
              {/* Cuenta origen */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Cuenta de donde sale el pago
                </label>
                <select
                  required
                  value={pagoForm.cuenta_id}
                  onChange={(e) => setPagoForm({ ...pagoForm, cuenta_id: e.target.value })}
                  className={INPUT_CLS}
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentas.filter(c => c.tipo !== "credito").map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Capital e Interés */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Capital (RD$)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={pagoForm.capital}
                    onChange={(e) => setPagoForm({ ...pagoForm, capital: e.target.value })}
                    placeholder="0.00"
                    className={INPUT_CLS}
                  />
                  <p className="text-gray-600 text-xs mt-1">Reduce el saldo</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Interés (RD$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pagoForm.interes}
                    onChange={(e) => setPagoForm({ ...pagoForm, interes: e.target.value })}
                    placeholder="0.00"
                    className={INPUT_CLS}
                  />
                  <p className="text-gray-600 text-xs mt-1">Gasto financiero</p>
                </div>
              </div>
              <p className="text-gray-600 text-xs -mt-2">
                Puedes ajustar los valores si tu banco indica otros montos.
              </p>

              {/* Total calculado */}
              {(pagoForm.capital || pagoForm.interes) && (
                <div className="bg-gray-800 rounded-lg px-3 py-2 flex justify-between text-sm">
                  <span className="text-gray-400">Total a descontar de la cuenta:</span>
                  <span className="text-white font-semibold">
                    {fmt((parseFloat(pagoForm.capital) || 0) + (parseFloat(pagoForm.interes) || 0))}
                  </span>
                </div>
              )}

              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Fecha</label>
                <input
                  type="date"
                  required
                  value={pagoForm.fecha}
                  onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Notas (opcional)</label>
                <input
                  type="text"
                  value={pagoForm.notas}
                  onChange={(e) => setPagoForm({ ...pagoForm, notas: e.target.value })}
                  placeholder="Ej: Cuota 12"
                  className={INPUT_CLS}
                />
              </div>

              <button
                type="submit"
                disabled={saving || !pagoForm.capital || !pagoForm.cuenta_id}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Guardando..." : "Confirmar pago"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Error box ─────────────────────────────────────────────────────────────────

function ErrorBox({ message }) {
  const needsMigration = message.includes("dia_pago") || message.includes("column");
  return (
    <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 space-y-2">
      <p className="text-red-400 text-xs font-semibold">Error al guardar</p>
      <p className="text-red-300 text-xs font-mono break-all">{message}</p>
      {needsMigration && (
        <div className="mt-2 pt-2 border-t border-red-800/50">
          <p className="text-gray-400 text-xs mb-1">
            Ejecuta esto en Supabase → SQL Editor:
          </p>
          <pre className="bg-gray-900 rounded p-2 text-xs text-emerald-300 overflow-x-auto">
            {"ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS dia_pago SMALLINT;"}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Migration banner ───────────────────────────────────────────────────────────

function MigracionBanner({ prestamos }) {
  const [dismissed, setDismissed] = useState(false);
  // Show banner if any prestamo lacks dia_pago (column might not exist yet or is null)
  const sinDiaPago = prestamos.some((p) => p.dia_pago == null);
  if (!sinDiaPago || dismissed) return null;
  return (
    <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-4 flex gap-3">
      <div className="flex-1 space-y-2">
        <p className="text-amber-400 text-sm font-medium">
          Acción requerida: agrega la columna <code className="font-mono">dia_pago</code> en Supabase
        </p>
        <p className="text-gray-400 text-xs">
          Para guardar el día de pago de tus préstamos, ejecuta este SQL en tu proyecto de Supabase (SQL Editor):
        </p>
        <pre className="bg-gray-900 rounded-lg p-3 text-xs text-emerald-300 overflow-x-auto">
          {"ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS dia_pago SMALLINT;"}
        </pre>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-gray-600 hover:text-white flex-shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ── Shared form component ──────────────────────────────────────────────────────

function PrestamoForm({ form, setForm, onSubmit, saving, label, isEdit }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Nombre del préstamo
        </label>
        <input
          type="text"
          required
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Ej: BPD Personal, BHD Hipotecario"
          className={INPUT_CLS}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Monto total del préstamo (RD$)
        </label>
        <input
          type="number"
          required
          min="0"
          step="0.01"
          value={form.monto_total}
          onChange={(e) =>
            setForm({
              ...form,
              monto_total: e.target.value,
              ...(!isEdit && { monto_restante: e.target.value }),
            })
          }
          placeholder="0.00"
          className={INPUT_CLS}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Monto restante por pagar (RD$)
        </label>
        <input
          type="number"
          required
          min="0"
          step="0.01"
          value={form.monto_restante}
          onChange={(e) => setForm({ ...form, monto_restante: e.target.value })}
          placeholder="0.00"
          className={INPUT_CLS}
        />
        {!isEdit && (
          <p className="text-gray-600 text-xs mt-1">
            Si acabas de sacar el préstamo, deja igual al monto total.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Cuota mensual (RD$)
        </label>
        <input
          type="number"
          required
          min="0"
          step="0.01"
          value={form.cuota_mensual}
          onChange={(e) => setForm({ ...form, cuota_mensual: e.target.value })}
          placeholder="0.00"
          className={INPUT_CLS}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Día de pago mensual (1–31)
        </label>
        <input
          type="number"
          min="1"
          max="31"
          value={form.dia_pago}
          onChange={(e) => setForm({ ...form, dia_pago: e.target.value })}
          placeholder="Ej: 5 → paga el día 5 de cada mes"
          className={INPUT_CLS}
        />
        <p className="text-gray-600 text-xs mt-1">
          Usado para el seguimiento de liquidez quincenal en el Dashboard.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Tasa de interés anual (%) — opcional
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.tasa_interes}
          onChange={(e) => setForm({ ...form, tasa_interes: e.target.value })}
          placeholder="0"
          className={INPUT_CLS}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Fecha de inicio
        </label>
        <input
          type="date"
          required
          value={form.fecha_inicio}
          onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
          className={INPUT_CLS}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Notas (opcional)
        </label>
        <input
          type="text"
          value={form.notas}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
          placeholder="Ej: Banco BPD, tasa fija"
          className={INPUT_CLS}
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
      >
        {saving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isEdit ? (
          <Pencil size={16} />
        ) : (
          <Plus size={16} />
        )}
        {saving ? "Guardando..." : label}
      </button>
    </form>
  );
}
