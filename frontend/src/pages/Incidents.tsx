import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, Incident, Service } from "../api/client";
import {
  AlertTriangle,
  RefreshCw,
  Zap,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [serviceFilter, setServiceFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  const fetchIncidents = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (serviceFilter !== "ALL") params.serviceId = serviceFilter;

      const [incidentsRes, servicesRes] = await Promise.all([
        api.get<Incident[]>("/incidents", { params }),
        api.get<Service[]>("/services"),
      ]);

      setIncidents(incidentsRes.data);
      setServices(servicesRes.data);
    } catch (e) {
      console.error("Failed to load incidents:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, serviceFilter]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <h1 className="page-title">
            <AlertTriangle size={22} color="var(--degraded)" /> Incidents & AI Diagnoses
          </h1>
          <p className="page-sub">
            Chronological audit trail of autonomous AI-correlated root cause reports and telemetry snapshots.
          </p>
        </div>

        <button className="btn secondary" onClick={() => fetchIncidents()} style={{ fontSize: 12 }}>
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: "14px 18px", marginBottom: 18, marginTop: 14, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Status:</label>
          <div className="tab-group">
            {["ALL", "OPEN", "INVESTIGATING", "RESOLVED"].map((st) => (
              <button
                key={st}
                type="button"
                className={`tab-btn ${statusFilter === st ? "active" : ""}`}
                style={{ fontSize: 11.5, padding: "4px 10px" }}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Service:</label>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Monitored Services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Incidents List */}
      {loading ? (
        <p className="page-sub">Loading incident diagnoses…</p>
      ) : incidents.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <CheckCircle2 size={36} color="var(--ok)" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#fff" }}>No incidents found</div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            {statusFilter !== "ALL" || serviceFilter !== "ALL"
              ? "Try broadening your filter criteria to view more incidents."
              : "All systems operating within baseline parameters ($\le 3\\sigma$). Click '⚡ Simulate Anomaly' on Dashboard to trigger a test incident."}
          </p>
        </div>
      ) : (
        incidents.map((incident) => (
          <Link to={`/incidents/${incident.id}`} key={incident.id} style={{ textDecoration: "none", display: "block" }}>
            <div className="incident-row">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div className="meta" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ color: "#fff" }}>{incident.service.name}</strong>
                  <span>·</span>
                  <span>{new Date(incident.createdAt).toLocaleTimeString()}</span>
                  <span>·</span>
                  <span>{new Date(incident.createdAt).toLocaleDateString()}</span>
                  {incident.timeToRootCauseSeconds && (
                    <>
                      <span>·</span>
                      <span style={{ color: "var(--cyan-neon)", display: "flex", alignItems: "center", gap: 3 }}>
                        <Clock size={11} /> {incident.timeToRootCauseSeconds}s to root cause
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {incident.alerts && incident.alerts.length > 0 && (
                    <span className="badge" style={{ fontSize: 10 }}>
                      <Send size={10} /> {incident.alerts.length} alerts
                    </span>
                  )}
                  <span className={`badge ${incident.status.toLowerCase()}`}>
                    {incident.status}
                  </span>
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: 15.5, color: "#fff", marginBottom: 4 }}>
                {incident.whatFailed}
              </div>

              <div className="translation">
                <span className="label">
                  <Zap size={12} color="var(--ai-purple-light)" /> AI Root Cause Diagnosis
                </span>
                {incident.whyReason}
              </div>

              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ color: "var(--text-main)" }}>Downstream Impact:</strong> {incident.impact}
                </div>
                <div style={{ color: "var(--cyan-neon)", display: "flex", alignItems: "center", gap: 4, fontWeight: 600, fontSize: 12 }}>
                  <span>View Telemetry</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            </div>
          </Link>
        ))
      )}
    </>
  );
}
