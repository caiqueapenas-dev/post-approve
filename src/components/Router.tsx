import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AdminDashboard } from "../pages/AdminDashboard";
import { AdminLogin } from "../pages/AdminLogin";
import { ClientPreview } from "../pages/ClientPreview";

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" />;
  }
  return children;
};

export const Router = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/client/:linkId" element={<ClientPreview />} />
      </Routes>
    </BrowserRouter>
  );
};