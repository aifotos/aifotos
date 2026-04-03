export function Tarjetas() {
  return <PlaceholderView title="Tarjetas" emoji="💳" />;
}

export function Prestamos() {
  return <PlaceholderView title="Préstamos" emoji="🏦" />;
}

export function Presupuesto() {
  return <PlaceholderView title="Presupuesto" emoji="📊" />;
}

function PlaceholderView({ title, emoji }) {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">{title}</h1>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <span className="text-4xl">{emoji}</span>
        <p className="text-gray-500 mt-3">Próximamente</p>
      </div>
    </div>
  );
}