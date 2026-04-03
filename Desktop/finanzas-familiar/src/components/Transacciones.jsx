import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Plus,
  X,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
} from "lucide-react";

const fmt = (n) =>
  Number(n).toLocaleString("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const fmtFecha = (f) =>
  new Date(f + "T00:00:00").toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function Transacciones() {
  const { perfil } = useAuth();
  const [transacciones, setTransacciones] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatForm, setNewCatForm] = useState({ nombre: "", icono: "", tipo: "gasto" });
  const [creatingCat, setCreatingCat] = useState(false);
  const [tipoEntrada, setTipoEntrada] = useState("transaccion");
  const [form, setForm] = useState({
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
    notas: "",
    categoria_id: "",
    cuenta_id: "",
    cuenta_origen_id: "",
    cuenta_destino_id: "",
  });

  useEffect(() => {
    if (!perfil?.id) return;
    fetchAll();
  }, [perfil?.id]);

  async function fetchAll() {
    setLoading(true);
    const [txRes, catRes, cuentaRes, pagosRes] = await Promise.all([
      supabase
        .from("transacciones")
        .select(
          "id, monto, fecha, notas, created_at, categorias(nombre, icono, tipo), cuentas(nombre)"
        )
        .eq("perfil_id", perfil.id)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("categorias")
        .select("id, nombre, icono, tipo")
        .eq("perfil_id", perfil.id)
        .order("nombre"),
      supabase
        .from("cuentas")
        .select("id, nombre, tipo")
        .eq("perfil_id", perfil.id)
        .order("nombre"),
      supabase
        .from("pagos_tarjeta")
        .select(
          "id, monto, fecha, notas, created_at, cuenta_origen_id, cuenta_destino_id, cuentas_origen:cuentas!cuenta_origen_id(nombre), cuentas_destino:cuentas!cuenta_destino_id(nombre)"
        )
        .eq("perfil_id", perfil.id)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    setTransacciones(txRes.data || []);
    setCategorias(catRes.data || []);
    setCuentas(cuentaRes.data || []);
    setPagos(pagosRes.data || []);
    setLoading(false);
  }

  function openModal() {
    setTipoEntrada("transaccion");
    setForm({
      monto: "",
      fecha: new Date().toISOString().split("T")[0],
      notas: "",
      categoria_id: "",
      cuenta_id: "",
      cuenta_origen_id: "",
      cuenta_destino_id: "",
    });
    setShowNewCat(false);
    setNewCatForm({ nombre: "", icono: "", tipo: "gasto" });
    setModalOpen(true);
  }

  async function handleCreateCat() {
    if (!newCatForm.nombre.trim() || !newCatForm.icono.trim()) return;
    setCreatingCat(true);
    const { data: nueva } = await supabase
      .from("categorias")
      .insert({
        perfil_id: perfil.id,
        nombre: newCatForm.nombre.trim(),
        icono: newCatForm.icono.trim(),
        tipo: newCatForm.tipo,
      })
      .select()
      .single();
    await fetchAll();
    if (nueva) updateForm("categoria_id", nueva.id);
    setShowNewCat(false);
    setNewCatForm({ nombre: "", icono: "", tipo: "gasto" });
    setCreatingCat(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (tipoEntrada === "pago_tarjeta") {
      if (!form.monto || !form.cuenta_origen_id || !form.cuenta_destino_id) return;
      setSaving(true);
      const { error } = await supabase.from("pagos_tarjeta").insert({
        perfil_id: perfil.id,
        cuenta_origen_id: form.cuenta_origen_id,
        cuenta_destino_id: form.cuenta_destino_id,
        monto: parseFloat(form.monto),
        fecha: form.fecha,
        notas: form.notas || null,
      });
      if (!error) {
        setModalOpen(false);
        fetchAll();
      }
      setSaving(false);
      return;
    }

    if (!form.monto || !form.cuenta_id || !form.categoria_id) return;
    setSaving(true);
    const { error } = await supabase.from("transacciones").insert({
      perfil_id: perfil.id,
      cuenta_id: form.cuenta_id,
      categoria_id: form.categoria_id,
      monto: parseFloat(form.monto),
      fecha: form.fecha,
      notas: form.notas || null,
    });
    if (!error) {
      setModalOpen(false);
      fetchAll();
    }
    setSaving(false);
  }

  async function handleDelete(id, tipo) {
    const tabla = tipo === "pago_tarjeta" ? "pagos_tarjeta" : "transacciones";
    const { error } = await supabase.from(tabla).delete().eq("id", id);
    if (!error) {
      if (tipo === "pago_tarjeta") {
        setPagos((prev) => prev.filter((p) => p.id !== id));
      } else {
        setTransacciones((prev) => prev.filter((t) => t.id !== id));
      }
    }
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSeedCategorias() {
    setSeeding(true);
    const defaults = [
      { nombre: "Salario", icono: "💼", tipo: "ingreso" },
      { nombre: "Freelance", icono: "💻", tipo: "ingreso" },
      { nombre: "Negocio", icono: "🏢", tipo: "ingreso" },
      { nombre: "Inversiones", icono: "📈", tipo: "ingreso" },
      { nombre: "Otros ingresos", icono: "💰", tipo: "ingreso" },
      { nombre: "Supermercado", icono: "🛒", tipo: "gasto" },
      { nombre: "Alquiler/Vivienda", icono: "🏠", tipo: "gasto" },
      { nombre: "Servicios (Luz, Agua)", icono: "⚡", tipo: "gasto" },
      { nombre: "Transporte", icono: "🚗", tipo: "gasto" },
      { nombre: "Restaurantes", icono: "🍔", tipo: "gasto" },
      { nombre: "Salud", icono: "💊", tipo: "gasto" },
      { nombre: "Educación", icono: "📚", tipo: "gasto" },
      { nombre: "Ropa", icono: "👗", tipo: "gasto" },
      { nombre: "Entretenimiento", icono: "🎬", tipo: "gasto" },
      { nombre: "Pago préstamo", icono: "🏦", tipo: "gasto" },
      { nombre: "Tecnología", icono: "📱", tipo: "gasto" },
      { nombre: "Otros gastos", icono: "💸", tipo: "gasto" },
    ];
    await supabase.from("categorias").insert(
      defaults.map((c) => ({ ...c, perfil_id: perfil.id }))
    );
    await fetchAll();
    setSeeding(false);
  }

  // Combinar transacciones y pagos a tarjeta ordenados por fecha
  const allItems = [
    ...transacciones.map((t) => ({ ...t, _tipo: "transaccion" })),
    ...pagos.map((p) => ({ ...p, _tipo: "pago_tarjeta" })),
  ].sort((a, b) => {
    if (b.fecha !== a.fecha) return b.fecha.localeCompare(a.fecha);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const cuentasOrigen = cuentas.filter((c) => c.tipo !== "credito");
  const tarjetas = cuentas.filter((c) => c.tipo === "credito");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Transacciones</h1>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nueva
        </button>
      </div>

      {/* Lista */}
      {allItems.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
          <span className="text-4xl block mb-3">💸</span>
          No hay transacciones registradas.
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden sm:block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 font-medium">Categoría</th>
                  <th className="text-left px-5 py-3 font-medium">Cuenta</th>
                  <th className="text-left px-5 py-3 font-medium">Notas</th>
                  <th className="text-right px-5 py-3 font-medium">Monto</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {allItems.map((item) => {
                  if (item._tipo === "pago_tarjeta") {
                    return (
                      <tr
                        key={`p-${item.id}`}
                        className="hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                          {fmtFecha(item.fecha)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-2">
                            <span>💳</span>
                            <span className="text-blue-400">Pago a tarjeta</span>
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-400">
                          {item.cuentas_origen?.nombre} → {item.cuentas_destino?.nombre}
                        </td>
                        <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">
                          {item.notas || "—"}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <span className="font-semibold tabular-nums text-blue-400">
                            {fmt(item.monto)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => handleDelete(item.id, "pago_tarjeta")}
                            className="text-gray-600 hover:text-red-400 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  const esIngreso = item.categorias?.tipo === "ingreso";
                  return (
                    <tr
                      key={`t-${item.id}`}
                      className="hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                        {fmtFecha(item.fecha)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2">
                          <span>{item.categorias?.icono || "📦"}</span>
                          <span className="text-gray-200">
                            {item.categorias?.nombre || "—"}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400">
                        {item.cuentas?.nombre || "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">
                        {item.notas || "—"}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {esIngreso ? (
                            <ArrowUpRight size={14} className="text-emerald-400" />
                          ) : (
                            <ArrowDownRight size={14} className="text-red-400" />
                          )}
                          <span
                            className={`font-semibold tabular-nums ${
                              esIngreso ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {fmt(item.monto)}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => handleDelete(item.id, "transaccion")}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden space-y-2">
            {allItems.map((item) => {
              if (item._tipo === "pago_tarjeta") {
                return (
                  <div
                    key={`p-${item.id}`}
                    className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl flex-shrink-0">💳</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-blue-400 truncate">
                          Pago a tarjeta
                        </p>
                        <p className="text-xs text-gray-500">
                          {fmtFecha(item.fecha)} · {item.cuentas_origen?.nombre} →{" "}
                          {item.cuentas_destino?.nombre}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-sm font-semibold tabular-nums text-blue-400">
                        {fmt(item.monto)}
                      </span>
                      <button
                        onClick={() => handleDelete(item.id, "pago_tarjeta")}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              }

              const esIngreso = item.categorias?.tipo === "ingreso";
              return (
                <div
                  key={`t-${item.id}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0">
                      {item.categorias?.icono || "📦"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">
                        {item.categorias?.nombre || "Sin categoría"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {fmtFecha(item.fecha)} · {item.cuentas?.nombre}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        esIngreso ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {fmt(item.monto)}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id, "transaccion")}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header modal */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Nueva transacción</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Toggle tipo entrada */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTipoEntrada("transaccion")}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                  tipoEntrada === "transaccion"
                    ? "bg-emerald-600/20 border border-emerald-600 text-emerald-400"
                    : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                💸 Transacción
              </button>
              <button
                type="button"
                onClick={() => setTipoEntrada("pago_tarjeta")}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                  tipoEntrada === "pago_tarjeta"
                    ? "bg-blue-600/20 border border-blue-600 text-blue-400"
                    : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                💳 Pago a tarjeta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Monto */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Monto (RD$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.monto}
                  onChange={(e) => updateForm("monto", e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Fecha
                </label>
                <input
                  type="date"
                  required
                  value={form.fecha}
                  onChange={(e) => updateForm("fecha", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
              </div>

              {tipoEntrada === "pago_tarjeta" ? (
                <>
                  {tarjetas.length === 0 && (
                    <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 text-sm">
                      <p className="text-amber-300 font-medium">
                        No tienes tarjetas de crédito
                      </p>
                      <p className="text-amber-400/80 text-xs mt-1">
                        Ve a "Tarjetas/Cuentas" para agregar una tarjeta de crédito.
                      </p>
                    </div>
                  )}

                  {/* Cuenta origen */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Pagar desde (cuenta origen)
                    </label>
                    <select
                      required
                      value={form.cuenta_origen_id}
                      onChange={(e) => updateForm("cuenta_origen_id", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                    >
                      <option value="" disabled>
                        Seleccionar cuenta
                      </option>
                      {cuentasOrigen.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} ({c.tipo})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tarjeta destino */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Pagar a (tarjeta de crédito)
                    </label>
                    <select
                      required
                      value={form.cuenta_destino_id}
                      onChange={(e) => updateForm("cuenta_destino_id", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                    >
                      <option value="" disabled>
                        Seleccionar tarjeta
                      </option>
                      {tarjetas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* Aviso si no hay categorías */}
                  {categorias.length === 0 && (
                    <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 text-sm">
                      <p className="text-amber-300 font-medium mb-1">
                        No tienes categorías
                      </p>
                      <p className="text-amber-400/80 text-xs mb-2">
                        Necesitas categorías para registrar transacciones.
                      </p>
                      <button
                        type="button"
                        onClick={handleSeedCategorias}
                        disabled={seeding}
                        className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {seeding ? "Creando..." : "Crear categorías predeterminadas"}
                      </button>
                    </div>
                  )}

                  {/* Aviso si no hay cuentas */}
                  {cuentas.length === 0 && (
                    <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 text-sm">
                      <p className="text-blue-300 font-medium mb-1">No tienes cuentas</p>
                      <p className="text-blue-400/80 text-xs">
                        Ve a la sección "Tarjetas/Cuentas" para crear tu primera cuenta.
                      </p>
                    </div>
                  )}

                  {/* Categoría */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Categoría
                    </label>
                    <select
                      required
                      value={form.categoria_id}
                      onChange={(e) => updateForm("categoria_id", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    >
                      <option value="" disabled>
                        Seleccionar categoría
                      </option>
                      <optgroup label="Ingresos">
                        {categorias
                          .filter((c) => c.tipo === "ingreso")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icono} {c.nombre}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Gastos">
                        {categorias
                          .filter((c) => c.tipo === "gasto")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icono} {c.nombre}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Crear nueva categoría inline */}
                  {!showNewCat ? (
                    <button
                      type="button"
                      onClick={() => setShowNewCat(true)}
                      className="text-xs text-emerald-500 hover:text-emerald-400 transition -mt-2"
                    >
                      + Nueva categoría
                    </button>
                  ) : (
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 space-y-3 -mt-2">
                      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                        Nueva categoría
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="😀"
                          maxLength={2}
                          value={newCatForm.icono}
                          onChange={(e) =>
                            setNewCatForm({ ...newCatForm, icono: e.target.value })
                          }
                          className="w-12 text-center bg-gray-900 border border-gray-700 rounded-lg px-1 py-2 text-lg text-white focus:outline-none focus:border-emerald-500 transition"
                        />
                        <input
                          type="text"
                          placeholder="Nombre"
                          value={newCatForm.nombre}
                          onChange={(e) =>
                            setNewCatForm({ ...newCatForm, nombre: e.target.value })
                          }
                          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                      <div className="flex gap-2">
                        {["gasto", "ingreso"].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setNewCatForm({ ...newCatForm, tipo: t })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                              newCatForm.tipo === t
                                ? t === "gasto"
                                  ? "bg-red-600/20 border border-red-600 text-red-400"
                                  : "bg-emerald-600/20 border border-emerald-600 text-emerald-400"
                                : "bg-gray-900 border border-gray-700 text-gray-400"
                            }`}
                          >
                            {t === "gasto" ? "💸 Gasto" : "💰 Ingreso"}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowNewCat(false)}
                          className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium py-2 rounded-lg transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateCat}
                          disabled={
                            creatingCat ||
                            !newCatForm.nombre.trim() ||
                            !newCatForm.icono.trim()
                          }
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium py-2 rounded-lg transition"
                        >
                          {creatingCat ? "Creando..." : "Crear y seleccionar"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Cuenta */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Cuenta
                    </label>
                    <select
                      required
                      value={form.cuenta_id}
                      onChange={(e) => updateForm("cuenta_id", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    >
                      <option value="" disabled>
                        Seleccionar cuenta
                      </option>
                      {cuentas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} ({c.tipo})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Notas */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={form.notas}
                  onChange={(e) => updateForm("notas", e.target.value)}
                  placeholder="Descripción breve..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                {saving
                  ? "Guardando..."
                  : tipoEntrada === "pago_tarjeta"
                  ? "Registrar pago"
                  : "Guardar transacción"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
