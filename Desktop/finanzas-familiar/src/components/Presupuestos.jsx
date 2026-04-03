import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient.js";
import { Pencil, Trash2, Tags } from "lucide-react";

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
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

function PresupuestoRow({ presupuesto, gastado, onEdit, onDelete }) {
  const limite = Number(presupuesto.monto_limite);
  const pct = limite > 0 ? (gastado / limite) * 100 : 0;
  const pctClamped = Math.min(pct, 100);

  const barColor =
    pct > 100 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500";

  const statusColor =
    pct > 100 ? "text-red-400" : pct > 75 ? "text-amber-400" : "text-emerald-400";

  const fmt = (n) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{presupuesto.categorias?.icono || "📦"}</span>
          <p className="text-white font-semibold text-sm">
            {presupuesto.categorias?.nombre || "Sin categoría"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${statusColor}`}>
            {pct > 100 ? "Excedido" : `${Math.round(pct)}%`}
          </span>
          <button
            onClick={() => onEdit(presupuesto)}
            className="text-gray-500 hover:text-emerald-400 transition p-1 rounded-lg hover:bg-gray-800"
            title="Editar límite"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(presupuesto)}
            className="text-gray-500 hover:text-red-400 transition p-1 rounded-lg hover:bg-gray-800"
            title="Eliminar presupuesto"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Disponible en grande */}
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold tabular-nums ${pct > 100 ? "text-red-400" : pct > 75 ? "text-amber-400" : "text-emerald-400"}`}>
          {fmt(Math.max(limite - gastado, 0))}
        </span>
        <span className="text-xs text-gray-500">disponible</span>
        {pct > 100 && (
          <span className="text-xs text-red-400 font-medium">
            ({fmt(gastado - limite)} excedido)
          </span>
        )}
      </div>

      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pctClamped}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-400">
        <span>
          Gastado: <span className="text-white">{fmt(gastado)}</span>
        </span>
        <span>
          Límite: <span className="text-white">{fmt(limite)}</span>
        </span>
      </div>
      {presupuesto.dia_pago && (
        <p className="text-xs text-gray-600">
          Día de pago: <span className="text-gray-500">{presupuesto.dia_pago}</span>
        </p>
      )}
    </div>
  );
}

function ErrorBox({ message }) {
  const needsMigration = message.includes("dia_pago") || message.includes("column");
  return (
    <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 space-y-2 mt-3">
      <p className="text-red-400 text-xs font-semibold">Error al guardar</p>
      <p className="text-red-300 text-xs font-mono break-all">{message}</p>
      {needsMigration && (
        <pre className="bg-gray-900 rounded p-2 text-xs text-emerald-300 overflow-x-auto">
          {"ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS dia_pago SMALLINT;"}
        </pre>
      )}
    </div>
  );
}

export default function Presupuestos() {
  const { perfil } = useAuth();
  const [presupuestos, setPresupuestos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [gastosPorCat, setGastosPorCat] = useState({});
  const [loading, setLoading] = useState(true);

  // Modal crear
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ categoria_id: "", monto_limite: "", dia_pago: "" });

  // Modal editar
  const [editando, setEditando] = useState(null);
  const [editMonto, setEditMonto] = useState("");
  const [editDiaPago, setEditDiaPago] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [editSaveError, setEditSaveError] = useState(null);

  // Modal confirmar eliminar presupuesto
  const [eliminando, setEliminando] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Modal gestionar categorías
  const [modalCatsOpen, setModalCatsOpen] = useState(false);
  const [todasCategorias, setTodasCategorias] = useState([]);
  const [catForm, setCatForm] = useState({ nombre: "", icono: "", tipo: "gasto" });
  const [catSaving, setCatSaving] = useState(false);

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const finMesStr = `${finMes.getFullYear()}-${String(finMes.getMonth() + 1).padStart(2, "0")}-${String(finMes.getDate()).padStart(2, "0")}`;
  const mesLabel = hoy.toLocaleDateString("es-DO", { month: "long", year: "numeric" });

  const fetchData = async () => {
    const [{ data: cats }, { data: pres }, { data: txns }] = await Promise.all([
      supabase
        .from("categorias")
        .select("*")
        .eq("perfil_id", perfil.id)
        .eq("tipo", "gasto")
        .order("nombre"),
      supabase
        .from("presupuestos")
        .select("*, categorias(nombre, icono)")
        .eq("perfil_id", perfil.id)
        .eq("mes", mesActual),
      supabase
        .from("transacciones")
        .select("categoria_id, monto")
        .eq("perfil_id", perfil.id)
        .gte("fecha", mesActual)
        .lte("fecha", finMesStr),
    ]);

    // Todas las categorías para el gestor
    const { data: todasCats } = await supabase
      .from("categorias")
      .select("*")
      .eq("perfil_id", perfil.id)
      .order("tipo")
      .order("nombre");
    setTodasCategorias(todasCats || []);

    setCategorias(cats || []);
    setPresupuestos(pres || []);

    const gastos = {};
    (txns || []).forEach((t) => {
      if (t.categoria_id) {
        gastos[t.categoria_id] =
          (gastos[t.categoria_id] || 0) + Math.abs(Number(t.monto));
      }
    });
    setGastosPorCat(gastos);
    setLoading(false);
  };

  useEffect(() => {
    if (perfil?.id) fetchData();
  }, [perfil]);

  const categoriasDisponibles = categorias.filter(
    (c) => !presupuestos.some((p) => p.categoria_id === c.id)
  );

  // Crear
  const handleSubmit = async () => {
    if (!form.categoria_id || !form.monto_limite) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      perfil_id: perfil.id,
      categoria_id: form.categoria_id,
      monto_limite: Number(form.monto_limite),
      mes: mesActual,
    };
    if (form.dia_pago) payload.dia_pago = parseInt(form.dia_pago);
    const { error } = await supabase.from("presupuestos").insert(payload);
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setForm({ categoria_id: "", monto_limite: "", dia_pago: "" });
    setModalOpen(false);
    fetchData();
  };

  // Abrir edición
  const handleOpenEdit = (p) => {
    setEditando(p);
    setEditMonto(String(p.monto_limite));
    setEditDiaPago(p.dia_pago ? String(p.dia_pago) : "");
    setEditSaveError(null);
  };

  // Guardar edición
  const handleUpdate = async () => {
    if (!editMonto) return;
    setEditSaving(true);
    setEditSaveError(null);
    const updatePayload = { monto_limite: Number(editMonto) };
    if (editDiaPago) updatePayload.dia_pago = parseInt(editDiaPago);
    const { error } = await supabase
      .from("presupuestos")
      .update(updatePayload)
      .eq("id", editando.id);
    setEditSaving(false);
    if (error) { setEditSaveError(error.message); return; }
    setEditando(null);
    fetchData();
  };

  // Crear categoría
  const handleCreateCat = async () => {
    if (!catForm.nombre.trim() || !catForm.icono.trim()) return;
    setCatSaving(true);
    await supabase.from("categorias").insert({
      perfil_id: perfil.id,
      nombre: catForm.nombre.trim(),
      icono: catForm.icono.trim(),
      tipo: catForm.tipo,
    });
    setCatForm({ nombre: "", icono: "", tipo: "gasto" });
    setCatSaving(false);
    fetchData();
  };

  // Borrar categoría
  const handleDeleteCat = async (id) => {
    await supabase.from("categorias").delete().eq("id", id);
    fetchData();
  };

  // Confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!eliminando) return;
    setDeleteSaving(true);
    await supabase.from("presupuestos").delete().eq("id", eliminando.id);
    setEliminando(null);
    setDeleteSaving(false);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Cargando presupuestos...</p>
      </div>
    );
  }

  const totalLimite = presupuestos.reduce((s, p) => s + Number(p.monto_limite), 0);
  const totalGastado = presupuestos.reduce(
    (s, p) => s + (gastosPorCat[p.categoria_id] || 0),
    0
  );

  const fmt = (n) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Presupuesto</h2>
          <p className="text-gray-500 text-sm capitalize">{mesLabel}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalCatsOpen(true)}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-3 py-2 rounded-xl transition"
          >
            <Tags size={14} />
            Categorías
          </button>
          <button
            onClick={() => setModalOpen(true)}
            disabled={categoriasDisponibles.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            + Agregar
          </button>
        </div>
      </div>

      {presupuestos.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Total gastado</p>
            <p className="text-lg font-bold text-white">{fmt(totalGastado)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Total presupuestado</p>
            <p className="text-lg font-bold text-white">{fmt(totalLimite)}</p>
          </div>
        </div>
      )}

      {presupuestos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg mb-2">Sin presupuestos este mes</p>
          <p className="text-gray-600 text-sm">
            Define límites de gasto por categoría para controlar tus finanzas
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {presupuestos.map((p) => (
            <PresupuestoRow
              key={p.id}
              presupuesto={p}
              gastado={gastosPorCat[p.categoria_id] || 0}
              onEdit={handleOpenEdit}
              onDelete={setEliminando}
            />
          ))}
        </div>
      )}

      {/* Modal crear */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setSaveError(null); }}>
        <h3 className="text-lg font-bold text-white mb-5">Nuevo presupuesto</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Categoría</label>
            <select
              value={form.categoria_id}
              onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-600 transition appearance-none"
            >
              <option value="">Seleccionar...</option>
              {categoriasDisponibles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icono} {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Monto límite (RD$)</label>
            <input
              type="number"
              value={form.monto_limite}
              onChange={(e) => setForm({ ...form, monto_limite: e.target.value })}
              placeholder="5000"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Día de pago (opcional)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={form.dia_pago}
              onChange={(e) => setForm({ ...form, dia_pago: e.target.value })}
              placeholder="Ej: 5, 15, 28"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
            />
            <p className="text-xs text-gray-600 mt-1">Día del mes en que se realiza este pago</p>
          </div>
          {saveError && <ErrorBox message={saveError} />}
          <button
            onClick={handleSubmit}
            disabled={saving || !form.categoria_id || !form.monto_limite}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition mt-2"
          >
            {saving ? "Guardando..." : "Guardar presupuesto"}
          </button>
        </div>
      </Modal>

      {/* Modal editar límite */}
      <Modal open={!!editando} onClose={() => { setEditando(null); setEditSaveError(null); }}>
        <h3 className="text-lg font-bold text-white mb-1">Editar presupuesto</h3>
        {editando && (
          <>
            <p className="text-sm text-gray-400 mb-5">
              {editando.categorias?.icono} {editando.categorias?.nombre}
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Monto límite (RD$)
                </label>
                <input
                  type="number"
                  value={editMonto}
                  onChange={(e) => setEditMonto(e.target.value)}
                  placeholder="5000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
                  autoFocus
                />
                <p className="text-xs text-gray-600 mt-1">
                  Actual:{" "}
                  {new Intl.NumberFormat("es-DO", {
                    style: "currency",
                    currency: "DOP",
                  }).format(editando.monto_limite)}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Día de pago</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editDiaPago}
                  onChange={(e) => setEditDiaPago(e.target.value)}
                  placeholder="Ej: 5, 15, 28"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
                />
                <p className="text-xs text-gray-600 mt-1">Día del mes en que se realiza este pago</p>
              </div>
              {editSaveError && <ErrorBox message={editSaveError} />}
              <button
                onClick={handleUpdate}
                disabled={editSaving || !editMonto}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition"
              >
                {editSaving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Modal gestionar categorías */}
      <Modal open={modalCatsOpen} onClose={() => setModalCatsOpen(false)}>
        <h3 className="text-lg font-bold text-white mb-5">Gestionar categorías</h3>
        {/* Form nueva */}
        <div className="space-y-3 mb-5">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="😀"
              maxLength={2}
              value={catForm.icono}
              onChange={(e) => setCatForm({ ...catForm, icono: e.target.value })}
              className="w-14 text-center bg-gray-800 border border-gray-700 rounded-xl px-2 py-2.5 text-lg text-white focus:outline-none focus:border-emerald-600 transition"
            />
            <input
              type="text"
              placeholder="Nombre de categoría"
              value={catForm.nombre}
              onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition"
            />
          </div>
          <div className="flex gap-2">
            {["gasto", "ingreso"].map((t) => (
              <button
                key={t}
                onClick={() => setCatForm({ ...catForm, tipo: t })}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                  catForm.tipo === t
                    ? t === "gasto"
                      ? "bg-red-600/20 border border-red-600 text-red-400"
                      : "bg-emerald-600/20 border border-emerald-600 text-emerald-400"
                    : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                {t === "gasto" ? "💸 Gasto" : "💰 Ingreso"}
              </button>
            ))}
          </div>
          <button
            onClick={handleCreateCat}
            disabled={catSaving || !catForm.nombre.trim() || !catForm.icono.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition"
          >
            {catSaving ? "Creando..." : "+ Crear categoría"}
          </button>
        </div>
        {/* Lista */}
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {todasCategorias.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-4">No hay categorías aún.</p>
          ) : (
            todasCategorias.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between bg-gray-800/60 rounded-xl px-4 py-2.5"
              >
                <span className="text-sm text-gray-200">
                  {c.icono} {c.nombre}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      c.tipo === "gasto"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    {c.tipo}
                  </span>
                  <button
                    onClick={() => handleDeleteCat(c.id)}
                    className="text-gray-600 hover:text-red-400 transition p-1"
                    title="Eliminar categoría"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Modal confirmar eliminar */}
      <Modal open={!!eliminando} onClose={() => setEliminando(null)}>
        <h3 className="text-lg font-bold text-white mb-2">¿Eliminar presupuesto?</h3>
        {eliminando && (
          <>
            <p className="text-sm text-gray-400 mb-6">
              Se eliminará el presupuesto de{" "}
              <span className="text-white font-medium">
                {eliminando.categorias?.icono} {eliminando.categorias?.nombre}
              </span>{" "}
              para este mes. Tus transacciones no se verán afectadas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setEliminando(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteSaving}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-medium py-2.5 rounded-xl transition"
              >
                {deleteSaving ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
