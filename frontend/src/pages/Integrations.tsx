import { useState, useEffect } from "react";
import { api, AlertConfig, AlertChannel } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Sliders,
  Key,
  Copy,
  Check,
  Send,
  Plus,
  Trash2,
  Zap,
  Terminal,
  Layers,
  Code2,
} from "lucide-react";

export default function Integrations() {
  const { organization, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"prometheus" | "otel" | "loki" | "curl" | "python">("prometheus");
  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChannel, setNewChannel] = useState<AlertChannel>("SLACK");
  const [newTarget, setNewTarget] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const apiKey = organization?.apiKey || "devsight_key_demo_acme_prod_99182";
  const backendBase = window.location.origin;

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    try {
      const res = await api.get<AlertConfig[]>("/alerts/configs");
      setAlertConfigs(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConfigs(false);
    }
  }

  async function handleAddConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!newTarget.trim()) return;
    try {
      await api.post("/alerts/configs", { channel: newChannel, target: newTarget.trim() });
      setNewTarget("");
      setShowAddModal(false);
      await fetchConfigs();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Failed to add alert channel");
    }
  }

  async function handleDeleteConfig(id: string) {
    if (!confirm("Are you sure you want to remove this alert channel?")) return;
    try {
      await api.delete(`/alerts/configs/${id}`);
      await fetchConfigs();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Failed to remove channel");
    }
  }

  async function handleTestAlert(channel: AlertChannel, target: string, configId: string) {
    setTestingId(configId);
    try {
      await api.post("/alerts/test", { channel, target });
      alert(`✓ Test alert dispatched successfully to ${channel}!`);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Failed to send test alert");
    } finally {
      setTestingId(null);
    }
  }

  function copyToClipboard(text: string, isKey = false) {
    navigator.clipboard.writeText(text);
    if (isKey) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } else {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2500);
    }
  }

  const prometheusYaml = `# Add to your prometheus.yml config
remote_write:
  - url: "${backendBase}/api/ingest/prometheus"
    headers:
      X-API-Key: "${apiKey}"
    queue_config:
      max_samples_per_send: 500
      batch_send_deadline: 5s
`;

  const otelCollectorYaml = `# Add to otel-collector-config.yaml
exporters:
  otlphttp/devsight:
    endpoint: "${backendBase}/api/ingest"
    headers:
      X-API-Key: "${apiKey}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/devsight]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/devsight]
`;

  const promtailYaml = `# Add to promtail-config.yaml
clients:
  - url: "${backendBase}/api/ingest/loki"
    headers:
      X-API-Key: "${apiKey}"
    batchwait: 3s
    batchsize: 102400
`;

  const curlExample = `# Ingest custom metrics via standard cURL
curl -X POST "${backendBase}/api/ingest/prometheus" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "serviceName": "Payment Gateway",
    "name": "latency_ms",
    "value": 185.0
  }'
`;

  const pythonExample = `# Python OpenTelemetry Ingestion
import requests

def send_metric(service_name, metric_name, value):
    url = "${backendBase}/api/ingest/prometheus"
    headers = {"X-API-Key": "${apiKey}", "Content-Type": "application/json"}
    payload = {"serviceName": service_name, "name": metric_name, "value": value}
    requests.post(url, json=payload, headers=headers)
`;

  const activeSnippet =
    activeTab === "prometheus"
      ? prometheusYaml
      : activeTab === "otel"
      ? otelCollectorYaml
      : activeTab === "loki"
      ? promtailYaml
      : activeTab === "curl"
      ? curlExample
      : pythonExample;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">
            <Sliders size={22} /> Telemetry Ingestion & Integrations
          </h1>
          <p className="page-sub">
            Plug your existing Prometheus, OpenTelemetry, and Loki pipelines into DevSight AI in under 5 minutes.
          </p>
        </div>

        <button
          className="btn secondary"
          onClick={() => copyToClipboard(apiKey, true)}
          style={{ fontSize: 12.5 }}
        >
          {copiedKey ? <Check size={14} color="var(--ok)" /> : <Key size={14} />}
          <span>{copiedKey ? "API Key Copied!" : "Copy Ingestion API Key"}</span>
        </button>
      </div>

      {/* Organization API Key Banner */}
      <div className="card" style={{ borderLeft: "4px solid var(--cyan-neon)", marginBottom: 20, marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="card-title" style={{ margin: 0, color: "var(--cyan-neon)" }}>
              <Key size={13} /> Active Ingestion Key
            </div>
            <div className="mono" style={{ fontSize: 14, color: "#fff", marginTop: 4, fontWeight: 600 }}>
              {apiKey}
            </div>
          </div>
          <span className="badge" style={{ fontSize: 11.5, background: "rgba(0,210,255,0.1)", color: "var(--cyan-neon)" }}>
            Workspace: {organization?.name || "Acme Cloud Platforms"}
          </span>
        </div>
      </div>

      {/* Collector Configurations */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          <Code2 size={14} /> Telemetry Agent Configuration Snippets
        </div>

        <div className="tab-group" style={{ marginBottom: 14, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === "prometheus" ? "active" : ""}`}
            onClick={() => setActiveTab("prometheus")}
          >
            Prometheus (remote_write)
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "otel" ? "active" : ""}`}
            onClick={() => setActiveTab("otel")}
          >
            OpenTelemetry (OTLP)
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "loki" ? "active" : ""}`}
            onClick={() => setActiveTab("loki")}
          >
            Loki / Promtail
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "curl" ? "active" : ""}`}
            onClick={() => setActiveTab("curl")}
          >
            cURL / HTTP API
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "python" ? "active" : ""}`}
            onClick={() => setActiveTab("python")}
          >
            Python SDK
          </button>
        </div>

        <div style={{ position: "relative" }}>
          <button
            className="btn secondary"
            onClick={() => copyToClipboard(activeSnippet)}
            style={{ position: "absolute", top: 12, right: 12, fontSize: 11.5, padding: "5px 12px", gap: 5 }}
          >
            {copiedSnippet ? <Check size={13} color="var(--ok)" /> : <Copy size={13} />}
            <span>{copiedSnippet ? "Copied!" : "Copy Code"}</span>
          </button>
          <textarea
            readOnly
            rows={10}
            value={activeSnippet}
            style={{
              width: "100%",
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              background: "var(--bg-inset)",
              color: "#e2e8f0",
              border: "1px solid var(--border-card)",
              borderRadius: "var(--radius-sm)",
              padding: 14,
              lineHeight: 1.5,
            }}
          />
        </div>
      </div>

      {/* Multi-Channel Alerts */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="card-title" style={{ margin: 0 }}>
            <Send size={14} /> Configured Alert Notifications
          </div>
          {(user?.role === "ADMIN" || user?.role === "DEVOPS_ENGINEER") && (
            <button className="btn" onClick={() => setShowAddModal(true)} style={{ fontSize: 12 }}>
              <Plus size={14} />
              <span>Add Channel</span>
            </button>
          )}
        </div>

        {loadingConfigs ? (
          <p className="page-sub">Loading notification channel configurations…</p>
        ) : alertConfigs.length === 0 ? (
          <p className="page-sub">No notification webhooks configured. Dev fallback logs alerts to console.</p>
        ) : (
          alertConfigs.map((cfg) => (
            <div key={cfg.id} className="service-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="badge" style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
                  {cfg.channel}
                </span>
                <span className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {cfg.target}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="btn secondary"
                  disabled={testingId === cfg.id}
                  onClick={() => handleTestAlert(cfg.channel, cfg.target, cfg.id)}
                  style={{ fontSize: 11.5, padding: "5px 10px" }}
                >
                  <Zap size={12} color="var(--cyan-neon)" />
                  <span>{testingId === cfg.id ? "Sending..." : "Test Alert"}</span>
                </button>
                {(user?.role === "ADMIN" || user?.role === "DEVOPS_ENGINEER") && (
                  <button
                    className="btn secondary"
                    onClick={() => handleDeleteConfig(cfg.id)}
                    style={{ fontSize: 11.5, padding: "5px 8px", color: "var(--down)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Channel Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-title" style={{ fontSize: 16, marginBottom: 16 }}>
              Add Notification Dispatcher
            </div>
            <form onSubmit={handleAddConfig}>
              <div className="field">
                <label>Notification Channel Type</label>
                <select
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value as AlertChannel)}
                  className="filter-select"
                  style={{ width: "100%" }}
                >
                  <option value="SLACK">Slack Incoming Webhook</option>
                  <option value="TEAMS">Microsoft Teams Webhook</option>
                  <option value="EMAIL">Email On-Call Group</option>
                  <option value="WEBHOOK">Custom Webhook (PagerDuty / Opsgenie)</option>
                </select>
              </div>

              <div className="field">
                <label>Webhook URL or Email Address</label>
                <input
                  type="text"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder={
                    newChannel === "EMAIL"
                      ? "oncall-devops@company.com"
                      : "https://hooks.slack.com/services/..."
                  }
                  required
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
                <button type="button" className="btn secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button className="btn" type="submit">
                  Save Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
