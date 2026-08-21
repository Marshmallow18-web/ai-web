import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  AlertTriangle,
  Terminal,
  Sliders,
  CreditCard,
  LogOut,
  Zap,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export default function Sidebar() {
  const { user, organization, logout } = useAuth();

  const roleLabels: Record<string, string> = {
    ADMIN: "Admin",
    DEVOPS_ENGINEER: "DevOps",
    DEVELOPER: "Developer",
    MANAGER: "Manager",
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div>
        <div className="brand">
          <span style={{ display: "inline-flex", padding: 5, background: "var(--ai-gradient)", borderRadius: "var(--radius-sm)" }}>
            <Zap size={16} color="#fff" />
          </span>
          <span>
            DevSight<span className="brand-badge">AI</span>
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span className="status-dot HEALTHY" style={{ width: 6, height: 6 }} />
          <span className="mono" style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
            {organization?.name || "Acme Cloud"}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          <LayoutDashboard size={17} />
          <span>Unified Dashboard</span>
        </NavLink>
        <NavLink to="/incidents" className={({ isActive }) => (isActive ? "active" : "")}>
          <AlertTriangle size={17} />
          <span>AI Incidents</span>
        </NavLink>
        <NavLink to="/log-analyzer" className={({ isActive }) => (isActive ? "active" : "")}>
          <Terminal size={17} />
          <span>Live Logs & AI</span>
        </NavLink>
        <NavLink to="/integrations" className={({ isActive }) => (isActive ? "active" : "")}>
          <Sliders size={17} />
          <span>Integrations & OTel</span>
        </NavLink>
        <NavLink to="/billing" className={({ isActive }) => (isActive ? "active" : "")}>
          <CreditCard size={17} />
          <span>Billing & Limits</span>
        </NavLink>
      </nav>

      {/* User Session Footer */}
      <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
            {user?.name || "Engineer"}
          </div>
          <span className="badge" style={{ fontSize: 10, background: "rgba(139,92,246,0.15)", color: "var(--ai-purple-light)" }}>
            {organization?.planTier || "PRO"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <ShieldCheck size={13} color="var(--ok)" />
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            Role: <strong style={{ color: "var(--text-main)" }}>{user?.role ? roleLabels[user.role] || user.role : "User"}</strong>
          </span>
        </div>

        <button
          className="btn secondary"
          onClick={logout}
          style={{ width: "100%", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 10px" }}
        >
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
