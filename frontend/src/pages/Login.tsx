import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Zap, Shield, Mail, Lock, Building, ArrowRight, UserCheck } from "lucide-react";

export default function Login() {
  const { login, register, oauthLogin } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        if (!name.trim() || !organizationName.trim()) {
          setError("All fields are required for registration");
          setLoading(false);
          return;
        }
        await register(email, password, name, organizationName);
      }
      navigate("/");
    } catch (err: any) {
      // If user enters any new email/gmail in login mode, auto-register them seamlessly!
      if (mode === "login" && email.includes("@")) {
        try {
          const autoName = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ");
          const autoOrg = `${autoName.charAt(0).toUpperCase() + autoName.slice(1)}'s Workspace`;
          await register(email, password || "password123", autoName, autoOrg);
          navigate("/");
          return;
        } catch (regErr: any) {
          setError(regErr?.response?.data?.error || "Login failed");
        }
      } else {
        setError(err?.response?.data?.error || "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setError(null);
    setLoading(true);
    try {
      const defaultEmail = provider === "google" ? "engineer@gmail.com" : "devops@github.com";
      const defaultName = provider === "google" ? "Google SRE User" : "GitHub DevOps User";
      await oauthLogin(provider, defaultEmail, defaultName);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || `${provider} OAuth failed`);
    } finally {
      setLoading(false);
    }
  }

  function setDemoUser(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("password123");
    setMode("login");
    setError(null);
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 24, fontWeight: 800, color: "#fff" }}>
            <span style={{ display: "inline-flex", padding: 6, background: "var(--ai-gradient)", borderRadius: "var(--radius-sm)" }}>
              <Zap size={20} color="#fff" />
            </span>
            DevSight<span style={{ color: "var(--cyan-neon)" }}>AI</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
            Autonomous Cloud & Microservice Observability Copilot
          </p>
        </div>

        {/* OAuth Fast Sign-in Options */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          <button
            type="button"
            className="btn secondary"
            disabled={loading}
            onClick={() => handleOAuth("google")}
            style={{
              fontSize: 12.5,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Google OAuth
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={loading}
            onClick={() => handleOAuth("github")}
            style={{
              fontSize: 12.5,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub OAuth
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 18px", color: "var(--text-faint)", fontSize: 11, textTransform: "uppercase" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
          <span>Or sign in with any email</span>
          <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
        </div>

        {/* Tab selector */}
        <div className="tab-group" style={{ width: "100%", marginBottom: 18 }}>
          <button
            type="button"
            className={`tab-btn ${mode === "login" ? "active" : ""}`}
            style={{ flex: 1 }}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === "register" ? "active" : ""}`}
            style={{ flex: 1 }}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Register Org
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <div className="field">
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Building size={14} /> Organization / Company Name
                </label>
                <input
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  type="text"
                  placeholder="Acme Cloud Platforms"
                  required
                />
              </div>
              <div className="field">
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <UserCheck size={14} /> Full Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  placeholder="Alex Rivera"
                  required
                />
              </div>
            </>
          )}

          <div className="field">
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Mail size={14} /> Email / Gmail Address
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="name@company.com or you@gmail.com"
              required
            />
          </div>

          <div className="field">
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Lock size={14} /> Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && <div className="error-text">{error}</div>}

          <button className="btn" type="submit" style={{ width: "100%", padding: "10px", marginTop: 4 }} disabled={loading}>
            {loading ? "Authenticating..." : mode === "login" ? "Sign In to Copilot" : "Create Organization Workspace"}
            <ArrowRight size={16} />
          </button>
        </form>

        {mode === "login" && (
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 8, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>
              Quick Demo RBAC Logins:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 11.5, padding: "6px 8px" }}
                onClick={() => setDemoUser("admin@demo.com")}
              >
                👑 Admin
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 11.5, padding: "6px 8px" }}
                onClick={() => setDemoUser("devops@demo.com")}
              >
                ⚙️ DevOps
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 11.5, padding: "6px 8px" }}
                onClick={() => setDemoUser("developer@demo.com")}
              >
                💻 Developer
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 11.5, padding: "6px 8px" }}
                onClick={() => setDemoUser("manager@demo.com")}
              >
                📊 Manager
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
