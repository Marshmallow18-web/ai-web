import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, DashboardSummary } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Plus,
  RefreshCw,
  Zap,
  Server,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Shield,
  Trash2,
} from "lucide-react";

export default function Dashboard() {
  const { user, organization } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceBaseline, setNewServiceBaseline] = useState(150);
  const [submitting, setSubmitting] = useState(false);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get<DashboardSummary>("/dashboard");
      setData(res.data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 8000); // 8s auto-refresh
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/services", {
        name: newServiceName.trim(),
        baselineMs: Number(newServiceBaseline) || 120,
      });
      setNewServiceName("");
      setNewServiceBaseline(150);
      setShowAddModal(false);
      setActionMessage("✓ New service registered and telemetry baseline calibrated!");
      setTimeout(() => setActionMessage(null), 4000);
      await fetchDashboard();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Failed to add service");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSimulate(serviceId: string, type: "NORMAL" | "ANOMALY") {
    setSimulatingId(serviceId);
    setActionMessage(null);
    try {
      const res = await api.post("/metrics/simulate", { serviceId, type });
      if (type === "ANOMALY") {
        setActionMessage(`🚨 Anomaly simulated (${res.data.value}ms)! AI Root Cause analyzed and Incident created.`);
      } else {
        setActionMessage(`Normal metric point recorded (${res.data.value}ms).`);
      }
      setTimeout(() => setActionMessage(null), 6000);
      await fetchDashboard();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Simulation failed");
    } finally {
      setSimulatingId(null);
    }
  }

  async function handleDeleteService(serviceId: string, name: string) {
    if (!confirm(`Are you sure you want to delete service "${name}" and all its logs & metrics?`)) return;
    try {
      await api.delete(`/services/${serviceId}`);
      await fetchDashboard();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Failed to delete service");
    }
  }

  const isAdminOrDevops = user?.role === "ADMIN" || user?.role === "DEVOPS_ENGINEER";

  if (loading && !data) return <p className="page-sub">Loading DevSight observability command center…</p>;

  return (
    <>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="page-title">Unified Ops Dashboard</h1>
            <span className="badge" style={{ fontSize: 11, background: "rgba(0,210,255,0.1)", color: "var(--cyan-neon)" }}>
              Live Telemetry
            </span>
          </div>
          <p className="page-sub" style={{ margin: 0 }}>
            Real-time health, $\ge 3\sigma$ statistical anomalies, and plain-English AI incident translations.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
            Updated: {lastRefreshed}
          </span>
          <button className="btn secondary" onClick={() => fetchDashboard()} style={{ fontSize: 12 }}>
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
          {isAdminOrDevops && (
            <button className="btn" onClick={() => setShowAddModal(true)} style={{ fontSize: 12 }}>
              <Plus size={14} />
              <span>Add Service</span>
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="card" style={{ borderLeft: "4px solid var(--cyan-neon)", padding: "12px 16px", margin: "16px 0", background: "rgba(0,210,255,0.06)" }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{actionMessage}</span>
        </div>
      )}

      {data && (
        <>
          {/* Key Stat Cards */}
          <div className="stat-grid" style={{ marginTop: 18 }}>
            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="value">{data.totalServices}</div>
                  <div className="label">Monitored Microservices</div>
                </div>
                <Server size={20} color="var(--text-faint)" />
              </div>
            </div>

            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="value" style={{ color: data.openIncidentCount > 0 ? "var(--degraded)" : "var(--ok)" }}>
                    {data.openIncidentCount}
                  </div>
                  <div className="label">Active Open Incidents</div>
                </div>
                <AlertTriangle size={20} color={data.openIncidentCount > 0 ? "var(--degraded)" : "var(--text-faint)"} />
              </div>
            </div>

            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="value" style={{ color: "var(--ok)" }}>
                    {data.statusCounts.HEALTHY || 0}
                  </div>
                  <div className="label">Healthy Services</div>
                </div>
                <CheckCircle size={20} color="var(--ok)" />
              </div>
            </div>

            <div className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="value" style={{ color: (data.statusCounts.DEGRADED || 0) > 0 ? "var(--degraded)" : "var(--text-faint)" }}>
                    {data.statusCounts.DEGRADED || 0}
                  </div>
                  <div className="label">Degraded Services</div>
                </div>
                <Activity size={20} color="var(--degraded)" />
              </div>
            </div>
          </div>

          {/* Monitored Microservices Table */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="card-title" style={{ margin: 0 }}>
                <Server size={14} /> Monitored Cloud Services ({data.services.length})
              </div>
              <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                Click "⚡ Simulate Anomaly" to test real-time AI root-cause correlation
              </span>
            </div>

            {data.services.map((s) => (
              <div className="service-row" key={s.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`status-dot ${s.status}`} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <span className="mono">{s.baselineMs ? `Baseline: ${s.baselineMs}ms` : "Calibrating baseline"}</span>
                      <span>·</span>
                      <span>{s._count?.metrics || 0} metric pts</span>
                      <span>·</span>
                      <span>{s._count?.logs || 0} logs</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`badge ${s.status.toLowerCase()}`}>
                    {s.status}
                  </span>

                  <button
                    className="btn secondary"
                    style={{ fontSize: 11.5, padding: "5px 10px" }}
                    disabled={simulatingId === s.id}
                    onClick={() => handleSimulate(s.id, "NORMAL")}
                    title="Send normal traffic point near baseline"
                  >
                    Traffic
                  </button>

                  <button
                    className="btn"
                    style={{
                      fontSize: 11.5,
                      padding: "5px 10px",
                      background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
                      color: "#fff",
                      boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
                    }}
                    disabled={simulatingId === s.id}
                    onClick={() => handleSimulate(s.id, "ANOMALY")}
                    title="Force a >= 3-sigma spike and trigger autonomous AI diagnosis"
                  >
                    <Zap size={13} />
                    <span>{simulatingId === s.id ? "Analyzing..." : "⚡ Simulate Anomaly"}</span>
                  </button>

                  {isAdminOrDevops && (
                    <button
                      className="btn secondary"
                      style={{ fontSize: 11.5, padding: "5px 8px", color: "var(--down)" }}
                      onClick={() => handleDeleteService(s.id, s.name)}
                      title="Delete service"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {data.services.length === 0 && (
              <p className="page-sub" style={{ margin: "14px 0" }}>No monitored services registered yet. Click "+ Add Service" to connect one.</p>
            )}
          </div>

          {/* Recent AI Root Cause Diagnoses */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="card-title" style={{ margin: 0 }}>
                <Zap size={14} color="var(--ai-purple-light)" /> Autonomous AI Root Cause Diagnoses
              </div>
              <Link to="/incidents" style={{ fontSize: 12.5, color: "var(--cyan-neon)", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                <span>View all incidents</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>

            {data.recentIncidents.map((incident) => (
              <Link to={`/incidents/${incident.id}`} key={incident.id} style={{ display: "block", textDecoration: "none" }}>
                <div className="incident-row">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div className="meta" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ color: "#fff" }}>{incident.service.name}</strong>
                      <span>·</span>
                      <span>{new Date(incident.createdAt).toLocaleTimeString()}</span>
                      {incident.timeToRootCauseSeconds && (
                        <>
                          <span>·</span>
                          <span style={{ color: "var(--cyan-neon)" }}>Diagnosed in {incident.timeToRootCauseSeconds}s</span>
                        </>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span className={`badge ${incident.status.toLowerCase()}`}>
                        {incident.status}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 4 }}>
                    {incident.whatFailed}
                  </div>

                  <div className="translation">
                    <span className="label">
                      <Zap size={12} color="var(--ai-purple-light)" /> AI Root Cause Diagnosis
                    </span>
                    {incident.whyReason}
                  </div>
                </div>
              </Link>
            ))}

            {data.recentIncidents.length === 0 && (
              <p className="page-sub" style={{ margin: "10px 0" }}>
                No active incidents. Click <strong>"⚡ Simulate Anomaly"</strong> on any service above to test the autonomous AI diagnostic pipeline!
              </p>
            )}
          </div>
        </>
      )}

      {/* Add Service Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-title" style={{ fontSize: 16, marginBottom: 16 }}>
              Register Monitored Microservice
            </div>
            <form onSubmit={handleAddService}>
              <div className="field">
                <label>Microservice / Infra Component Name</label>
                <input
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. Recommendation Engine, Auth API, Payment Gateway"
                  required
                  autoFocus
                />
              </div>
              <div className="field">
                <label>Calibrated Baseline Latency (ms)</label>
                <input
                  type="number"
                  value={newServiceBaseline}
                  onChange={(e) => setNewServiceBaseline(Number(e.target.value))}
                  min={1}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
                <button type="button" className="btn secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={submitting}>
                  {submitting ? "Registering..." : "Create & Calibrate Baseline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
