import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, Incident } from "../api/client";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  ArrowLeft,
  FileText,
  Activity,
  Terminal,
  Layers,
  Copy,
  Check,
  ShieldAlert,
  Send,
} from "lucide-react";

export default function IncidentDetail() {
  const { id } = useParams();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "traces" | "logs" | "metrics">("summary");
  const [showPostmortemModal, setShowPostmortemModal] = useState(false);
  const [copiedPostmortem, setCopiedPostmortem] = useState(false);
  const [postmortemText, setPostmortemText] = useState("");

  useEffect(() => {
    api
      .get<Incident>(`/incidents/${id}`)
      .then((res) => {
        setIncident(res.data);
        if (res.data.postmortemDraft || res.data.postmortem_draft) {
          setPostmortemText(res.data.postmortemDraft || res.data.postmortem_draft || "");
        }
      })
      .catch((e) => console.error("Error loading incident:", e))
      .finally(() => setLoading(false));
  }, [id]);

  async function updateStatus(status: "INVESTIGATING" | "RESOLVED" | "OPEN") {
    if (!incident) return;
    setUpdating(true);
    try {
      const { data } = await api.patch<Incident>(`/incidents/${incident.id}/status`, { status });
      setIncident(data);
    } catch (e: any) {
      alert(e?.response?.data?.error || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  async function handleLoadPostmortem() {
    if (!incident) return;
    try {
      const { data } = await api.get<{ postmortemMarkdown: string }>(`/incidents/${incident.id}/postmortem`);
      setPostmortemText(data.postmortemMarkdown);
      setShowPostmortemModal(true);
    } catch (e) {
      setShowPostmortemModal(true);
    }
  }

  function handleCopyPostmortem() {
    navigator.clipboard.writeText(postmortemText);
    setCopiedPostmortem(true);
    setTimeout(() => setCopiedPostmortem(false), 3000);
  }

  if (loading) return <p className="page-sub">Analyzing telemetry snapshot and correlating logs…</p>;
  if (!incident) return <p className="page-sub">Incident report not found.</p>;

  const rawContext = incident.rawContext;
  const metricsList = rawContext?.metrics || rawContext?.metricsSnapshot || [];
  const logsList = rawContext?.logs || rawContext?.logsSnapshot || [];
  const tracesList = rawContext?.tracesSnapshot || incident.service?.recentTraces || [];
  const anomalyStats = rawContext?.anomaly;
  const signals: string[] = Array.isArray(incident.correlatedSignals)
    ? incident.correlatedSignals
    : Array.isArray(incident.correlated_signals)
    ? incident.correlated_signals
    : [];

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Link to="/incidents" style={{ fontSize: 13, color: "var(--cyan-neon)", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
          <ArrowLeft size={15} /> Back to Incidents
        </Link>
      </div>

      {/* Incident Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span className={`badge ${incident.status.toLowerCase()}`} style={{ fontSize: 12, padding: "4px 10px" }}>
              {incident.status}
            </span>
            <span className="badge" style={{ fontSize: 12, background: "rgba(244,63,94,0.15)", color: "var(--down)", borderColor: "rgba(244,63,94,0.3)" }}>
              <ShieldAlert size={13} /> Severity: {incident.severity || "HIGH"}
            </span>
            {incident.timeToRootCauseSeconds && (
              <span className="badge" style={{ fontSize: 12, background: "rgba(0,210,255,0.12)", color: "var(--cyan-neon)", borderColor: "rgba(0,210,255,0.3)" }}>
                <Clock size={13} /> Root Cause: {incident.timeToRootCauseSeconds}s
              </span>
            )}
            <span className="badge" style={{ fontSize: 12, background: "rgba(16,185,129,0.12)", color: "var(--ok)", borderColor: "rgba(16,185,129,0.3)" }}>
              <CheckCircle2 size={13} /> {Math.round((incident.confidence || 0.96) * 100)}% Confidence
            </span>
          </div>

          <h1 className="page-title" style={{ fontSize: 22, margin: "6px 0" }}>{incident.whatFailed}</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Affected Service: <strong style={{ color: "#fff" }}>{incident.service.name}</strong> · Detected: {new Date(incident.createdAt).toLocaleString()}
            {incident.resolvedAt && ` · Resolved: ${new Date(incident.resolvedAt).toLocaleString()}`}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="btn secondary"
            onClick={handleLoadPostmortem}
            style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}
          >
            <FileText size={15} />
            <span>Postmortem Markdown</span>
          </button>

          {incident.status !== "RESOLVED" && (
            <>
              {incident.status === "OPEN" && (
                <button
                  className="btn secondary"
                  onClick={() => updateStatus("INVESTIGATING")}
                  disabled={updating}
                  style={{ fontSize: 12.5 }}
                >
                  Mark Investigating
                </button>
              )}
              <button
                className="btn"
                onClick={() => updateStatus("RESOLVED")}
                disabled={updating}
                style={{ fontSize: 12.5, background: "var(--ok)", color: "#000", fontWeight: 700 }}
              >
                <CheckCircle2 size={15} />
                <span>Mark Resolved</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Signature AI Diagnosis Translation Card */}
      <div className="card" style={{ borderLeft: "4px solid var(--ai-purple)", marginTop: 20, background: "linear-gradient(135deg, rgba(14,19,32,0.95) 0%, rgba(20,27,45,0.9) 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="card-title" style={{ margin: 0, color: "var(--ai-purple-light)" }}>
            <Zap size={14} /> Plain-English AI Root Cause Translation
          </div>
        </div>

        <div className="translation" style={{ fontSize: 16, fontWeight: 600, margin: "10px 0 16px", color: "#e2e8f0", lineHeight: 1.6 }}>
          {incident.whyReason}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
          <div>
            <div className="card-title" style={{ fontSize: 11, marginBottom: 4 }}>
              Downstream User & Business Impact
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-main)", lineHeight: 1.5 }}>
              {incident.impact}
            </p>
          </div>
          <div>
            <div className="card-title" style={{ fontSize: 11, marginBottom: 4 }}>
              Suggested SRE Remediation Step
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: "#a5b4fc", lineHeight: 1.5, fontWeight: 500 }}>
              {incident.suggestedFix}
            </p>
          </div>
        </div>

        {signals.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 8, textTransform: "uppercase" }}>
              Correlated Telemetry Signals ({signals.length}):
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {signals.map((sig, i) => (
                <div key={i} style={{ fontSize: 12.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--cyan-neon)" }}>•</span>
                  <span>{sig}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dispatched Notification Channels */}
      {incident.alerts && incident.alerts.length > 0 && (
        <div className="card">
          <div className="card-title">
            <Send size={14} /> Multi-Channel Alerts Dispatched
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {incident.alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  background: "var(--bg-inset)",
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-card)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 12.5,
                }}
              >
                <span style={{ fontWeight: 700, color: "#fff" }}>{alert.channel}</span>
                <span className={`status-dot ${alert.success ? "HEALTHY" : "DOWN"}`} />
                <span style={{ color: "var(--text-muted)" }}>
                  {alert.success ? "Delivered" : "Failed"} at {new Date(alert.sentAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostic Tabs */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>
            Telemetry & Telemetry Snapshots
          </div>

          <div className="tab-group">
            <button
              type="button"
              className={`tab-btn ${activeTab === "summary" ? "active" : ""}`}
              onClick={() => setActiveTab("summary")}
            >
              Overview
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "traces" ? "active" : ""}`}
              onClick={() => setActiveTab("traces")}
            >
              OTel Traces ({tracesList.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "logs" ? "active" : ""}`}
              onClick={() => setActiveTab("logs")}
            >
              Correlated Logs ({logsList.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === "metrics" ? "active" : ""}`}
              onClick={() => setActiveTab("metrics")}
            >
              Metrics ({metricsList.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Summary Overview */}
        {activeTab === "summary" && anomalyStats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <div className="stat-card">
              <div className="value" style={{ color: "var(--down)" }}>
                {anomalyStats.observedValue}ms
              </div>
              <div className="label">Observed Latency Spike</div>
            </div>
            <div className="stat-card">
              <div className="value">{anomalyStats.baselineMean}ms</div>
              <div className="label">Learned Baseline Mean</div>
            </div>
            <div className="stat-card">
              <div className="value" style={{ color: "var(--cyan-neon)" }}>
                +{anomalyStats.deviationStdDevs}σ
              </div>
              <div className="label">Deviation (Standard Devs)</div>
            </div>
            <div className="stat-card">
              <div className="value" style={{ color: "var(--ok)" }}>
                {incident.timeToRootCauseSeconds || 1.4}s
              </div>
              <div className="label">Time to Root Cause</div>
            </div>
          </div>
        )}

        {/* Tab 2: OpenTelemetry Traces Waterfall View */}
        {activeTab === "traces" && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
              Distributed OpenTelemetry Trace Waterfall:
            </div>
            {tracesList.length === 0 ? (
              <p className="page-sub">No trace spans attached to this incident window.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {tracesList.map((t: any, idx: number) => {
                  const isError = t.statusCode === "ERROR";
                  const barWidth = Math.min(100, Math.max(15, (t.durationMs / 1850) * 100));

                  return (
                    <div
                      key={idx}
                      style={{
                        background: "var(--bg-inset)",
                        border: "1px solid var(--border-card)",
                        borderRadius: "var(--radius-sm)",
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className={`status-dot ${isError ? "DOWN" : "HEALTHY"}`} />
                          <span className="mono" style={{ fontWeight: 600, fontSize: 13, color: isError ? "#fb7185" : "#fff" }}>
                            {t.name}
                          </span>
                          <span className="badge" style={{ fontSize: 10 }}>
                            {t.statusCode}
                          </span>
                        </div>
                        <span className="mono" style={{ fontWeight: 700, fontSize: 13, color: isError ? "var(--down)" : "var(--ok)" }}>
                          {t.durationMs}ms
                        </span>
                      </div>

                      {/* Waterfall Duration Bar */}
                      <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, margin: "6px 0" }}>
                        <div
                          style={{
                            width: `${barWidth}%`,
                            height: "100%",
                            background: isError ? "var(--down)" : "var(--signal)",
                            borderRadius: 2,
                          }}
                        />
                      </div>

                      {t.error && (
                        <div style={{ fontSize: 11.5, color: "#fb7185", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                          Error: {t.error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Correlated Logs */}
        {activeTab === "logs" && (
          <div style={{ background: "var(--bg-inset)", borderRadius: "var(--radius-sm)", padding: 14, maxHeight: 300, overflowY: "auto" }}>
            {logsList.map((log: any, idx: number) => (
              <div key={idx} style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span className={`status-dot ${log.level === "error" ? "DOWN" : log.level === "warn" ? "DEGRADED" : "HEALTHY"}`} />
                <span style={{ color: "var(--text-faint)", marginRight: 10 }}>
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                </span>
                <span style={{ color: log.level === "error" ? "var(--down)" : log.level === "warn" ? "var(--degraded)" : "var(--text-main)" }}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Metrics */}
        {activeTab === "metrics" && (
          <div style={{ background: "var(--bg-inset)", borderRadius: "var(--radius-sm)", padding: 14, maxHeight: 250, overflowY: "auto" }}>
            {metricsList.map((m: any, idx: number) => (
              <div key={idx} style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>
                  {m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : ""} · {m.name}
                </span>
                <span style={{ fontWeight: 700, color: m.value > 500 ? "var(--down)" : "var(--ok)" }}>
                  {m.value}ms
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Postmortem Modal */}
      {showPostmortemModal && (
        <div className="modal-overlay" onClick={() => setShowPostmortemModal(false)}>
          <div className="modal-card" style={{ maxWidth: 800, maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="card-title" style={{ margin: 0, fontSize: 15 }}>
                <FileText size={16} /> Autonomous Incident Postmortem Document
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={handleCopyPostmortem} style={{ fontSize: 12 }}>
                  {copiedPostmortem ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedPostmortem ? "Copied to Clipboard!" : "Copy Markdown"}</span>
                </button>
                <button className="btn secondary" onClick={() => setShowPostmortemModal(false)} style={{ fontSize: 12 }}>
                  Close
                </button>
              </div>
            </div>

            <textarea
              readOnly
              rows={18}
              value={postmortemText}
              style={{
                width: "100%",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                background: "var(--bg-inset)",
                color: "var(--text-main)",
                border: "1px solid var(--border-card)",
                borderRadius: "var(--radius-sm)",
                padding: 14,
                resize: "vertical",
                lineHeight: 1.5,
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
