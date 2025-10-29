import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Router } from "./components/Router";
import { AdminLogin } from "./components/AdminLogin";
import { AdminDashboard } from "./components/AdminDashboard";
import { ClientPreview } from "./components/ClientPreview";

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <Router
      routes={[
        {
          path: "/",
          element: user ? <AdminDashboard /> : <AdminLogin />,
        },
        {
          path: "/client/:linkId",
          element: <ClientPreview />,
        },
      ]}
    />
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
