import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import IncidentDetail from "./pages/IncidentDetail";
import LogAnalyzer from "./pages/LogAnalyzer";
import Integrations from "./pages/Integrations";
import Billing from "./pages/Billing";

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">{children}</div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/incidents"
            element={
              <Protected>
                <Incidents />
              </Protected>
            }
          />
          <Route
            path="/incidents/:id"
            element={
              <Protected>
                <IncidentDetail />
              </Protected>
            }
          />
          <Route
            path="/log-analyzer"
            element={
              <Protected>
                <LogAnalyzer />
              </Protected>
            }
          />
          <Route
            path="/integrations"
            element={
              <Protected>
                <Integrations />
              </Protected>
            }
          />
          <Route
            path="/billing"
            element={
              <Protected>
                <Billing />
              </Protected>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
