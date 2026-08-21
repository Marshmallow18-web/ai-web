import { useState, useEffect, useCallback } from "react";
import { api, LogEntry, Service } from "../api/client";
import {
  Terminal,
  Search,
  RefreshCw,
  Zap,
  Sparkles,
  Layers,
  Filter,
  CheckCircle,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export default function LogAnalyzer() {
  const [activeTab, setActiveTab] = useState<"live" | "raw">("live");

  // Raw explainer state
  const [rawLog, setRawLog] = useState("");
  const [rawExplanation, setRawExplanation] = useState<string | null>(null);
  const [rawLoading, setRawLoading] = useState(false);

  // Live logs state
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string>("ALL");
  const [selectedLevel, setSelectedLevel] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [inlineExplainingId, setInlineExplainingId] = useState<string | null>(null);
  const [inlineExplanation, setInlineExplanation] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    api.get<Service[]>("/services").then((res) => setServices(res.data)).catch(console.error);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params: Record<string, string> = { limit: "150" };
      if (selectedService !== "ALL") params.serviceId = selectedService;
      if (selectedLevel !== "ALL") params.level = selectedLevel.toLowerCase();
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get<LogEntry[]>("/logs", { params });
      setLogs(res.data);
    } catch (e) {
      console.error("Error loading logs:", e);
    } finally {
      setLogsLoading(false);
    }
  }, [selectedService, selectedLevel, searchQuery]);

  useEffect(() => {
    if (activeTab === "live") {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  async function handleRawAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!rawLog.trim()) return;
    setRawLoading(true);
    setRawExplanation(null);
    try {
      const { data } = await api.post("/logs/explain", { rawLog });
      setRawExplanation(data.explanation);
    } catch (err: any) {
      setRawExplanation(err?.response?.data?.error || "Failed to analyze log.");
    } finally {
      setRawLoading(false);
    }
  }

  async function explainInline(log: LogEntry) {
    setInlineExplainingId(log.id);
    setInlineExplanation(null);
    try {
      const { data } = await api.post("/logs/explain", { rawLog: `[${log.level}] ${log.message}` });
      setInlineExplanation({ id: log.id, text: data.explanation });
    } catch (err: any) {
      alert("Analysis failed: " + (err?.response?.data?.error || "Error"));
    } finally {
      setInlineExplainingId(null);
    }
  }

  function setPresetLog(type: "pool" | "timeout" | "oom" | "deadlock") {
    if (type === "pool") {
      setRawLog(
        "ERROR 2026-08-21 10:30:12 [pg-pool] Connection pool exhausted (active=50, max=50). Connection request timed out after 5000ms at DatabaseClient.acquire (/app/db.js:42)"
      );
    } else if (type === "timeout") {
      setRawLog(
        "WARN 2026-08-21 10:31:05 [http-proxy] Upstream HTTP 504 Gateway Timeout while proxying request to http://billing-internal-svc:8080/v1/charges/charge_9981"
      );
    } else if (type === "oom") {
      setRawLog(
        "FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory (heap used: 4096 MB, heap total: 4140 MB)"
      );
    } else {
      setRawLog(
        "ERROR: deadlock detected; Process 29141 waits for ExclusiveLock on relation of transaction 8812; blocked by process 29142."
      );
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <h1 className="page-title">
            <Terminal size={22} /> Log Stream & AI Explainer
          </h1>
          <p className="page-sub">
            Real-time multi-service log streaming and plain-English AI translation for stack traces.
          </p>
        </div>

        {activeTab === "live" && (
          <button className="btn secondary" onClick={() => fetchLogs()} style={{ fontSize: 12 }}>
            <RefreshCw size={13} />
            <span>Refresh Stream</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-group" style={{ marginBottom: 18, marginTop: 14 }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === "live" ? "active" : ""}`}
          onClick={() => setActiveTab("live")}
        >
          Live Service Stream ({logs.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "raw" ? "active" : ""}`}
          onClick={() => setActiveTab("raw")}
        >
          Raw Stack Trace Explainer
        </button>
      </div>

      {activeTab === "live" ? (
        <>
          {/* Filter Bar */}
          <div className="card" style={{ padding: "14px 18px", marginBottom: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Service:</label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Services</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Level:</label>
              <div className="tab-group">
                {["ALL", "INFO", "WARN", "ERROR"].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`tab-btn ${selectedLevel === lvl ? "active" : ""}`}
                    style={{ fontSize: 11.5, padding: "4px 9px" }}
                    onClick={() => setSelectedLevel(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--text-faint)" }} />
                <input
                  type="text"
                  placeholder="Search log messages, traces, errors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", paddingLeft: 30, fontSize: 12.5 }}
                />
              </div>
            </div>
          </div>

          {/* Terminal Log Window */}
          <div className="card" style={{ padding: "14px 18px", background: "var(--bg-inset)" }}>
            {logsLoading ? (
              <p className="page-sub" style={{ margin: "14px 0" }}>Streaming live telemetry logs…</p>
            ) : logs.length === 0 ? (
              <p className="page-sub" style={{ margin: "14px 0" }}>No log entries match your filter criteria.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "12px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className={`badge ${log.level}`} style={{ fontSize: 10, textTransform: "uppercase" }}>
                        {log.level}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                        {log.service?.name || "Service"}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <button
                      className="btn secondary"
                      style={{ fontSize: 11, padding: "3px 9px", gap: 5 }}
                      disabled={inlineExplainingId === log.id}
                      onClick={() => explainInline(log)}
                    >
                      <Zap size={12} color="var(--ai-purple-light)" />
                      <span>{inlineExplainingId === log.id ? "Analyzing..." : "Explain with AI"}</span>
                    </button>
                  </div>

                  <div
                    className="mono"
                    style={{
                      fontSize: 12.5,
                      color: log.level === "error" ? "#fb7185" : log.level === "warn" ? "#fbbf24" : "var(--text-main)",
                      lineHeight: 1.5,
                      wordBreak: "break-all",
                    }}
                  >
                    {log.message}
                  </div>

                  {inlineExplanation && inlineExplanation.id === log.id && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 14px",
                        background: "rgba(139, 92, 246, 0.12)",
                        borderRadius: "var(--radius-sm)",
                        borderLeft: "3px solid var(--ai-purple)",
                        border: "1px solid rgba(139, 92, 246, 0.25)",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "var(--ai-purple-light)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Sparkles size={12} /> Plain-English AI Diagnosis:
                      </span>
                      <span style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>{inlineExplanation.text}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <div className="card-title">
              <Terminal size={14} /> Paste Raw Stack Trace / System Dump
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Quick Presets:</span>
              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 11, padding: "4px 8px" }}
                onClick={() => setPresetLog("pool")}
              >
                DB Pool Exhaustion
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 11, padding: "4px 8px" }}
                onClick={() => setPresetLog("timeout")}
              >
                504 Gateway Timeout
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 11, padding: "4px 8px" }}
                onClick={() => setPresetLog("oom")}
              >
                Out of Memory (OOM)
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 11, padding: "4px 8px" }}
                onClick={() => setPresetLog("deadlock")}
              >
                DB Deadlock
              </button>
            </div>

            <form onSubmit={handleRawAnalyze}>
              <div className="field">
                <textarea
                  rows={9}
                  value={rawLog}
                  onChange={(e) => setRawLog(e.target.value)}
                  placeholder="Paste stack trace, unhandled exception, or raw log output here..."
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                />
              </div>
              <button className="btn" type="submit" disabled={rawLoading}>
                <Zap size={14} />
                <span>{rawLoading ? "Analyzing with AI…" : "Translate this Log into Plain English"}</span>
              </button>
            </form>
          </div>

          {rawExplanation && (
            <div className="card" style={{ borderLeft: "4px solid var(--ai-purple)", marginTop: 18 }}>
              <div className="card-title" style={{ color: "var(--ai-purple-light)" }}>
                <Sparkles size={14} /> Plain-English AI Translation
              </div>
              <p className="translation" style={{ fontSize: 15, margin: "6px 0 0", color: "#e2e8f0" }}>
                {rawExplanation}
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
