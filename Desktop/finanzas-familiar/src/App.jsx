import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import Transacciones from "./components/Transacciones";
import { Tarjetas, Presupuesto } from "./components/Views";
import Prestamos from "./components/Prestamos";
import Cuentas from "./components/Cuentas";
import Presupuestos from "./components/Presupuestos";
import SaludFinanciera from "./components/SaludFinanciera";

const views = {
  dashboard: Dashboard,
  transacciones: Transacciones,
  tarjetas: Cuentas,
  prestamos: Prestamos,
  presupuesto: Presupuestos,
  salud: SaludFinanciera,
};

function AppContent() {
  const { session, perfil, loading } = useAuth();
  const [currentView, setCurrentView] = useState("dashboard");

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white text-lg">Cargando...</p>
      </div>
    );
  }

  if (!session) return <Login />;

  if (!perfil) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white text-lg">Cargando perfil...</p>
      </div>
    );
  }

  const ActiveView = views[currentView] || Dashboard;

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      <ActiveView />
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;