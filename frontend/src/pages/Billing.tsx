import { useEffect, useState } from "react";
import { api, SubscriptionInfo, PlanTier } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  CreditCard,
  CheckCircle,
  Zap,
  Sparkles,
  Shield,
  Layers,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

export default function Billing() {
  const { user } = useAuth();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingTier, setSwitchingTier] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  async function fetchSubscription() {
    try {
      const res = await api.get<SubscriptionInfo>("/billing/subscription");
      setSub(res.data);
    } catch (e) {
      console.error("Failed to load subscription info:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwitchTier(tier: PlanTier) {
    setSwitchingTier(tier);
    setSuccessMessage(null);
    try {
      const res = await api.post("/billing/simulate-tier", { tier });
      setSuccessMessage(`✓ Plan tier successfully updated to ${tier}! Service limits refreshed.`);
      await fetchSubscription();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Failed to switch plan tier");
    } finally {
      setSwitchingTier(null);
    }
  }

  if (loading) return <p className="page-sub">Loading subscription and tier limits…</p>;

  const tiers = [
    {
      id: "STARTER" as PlanTier,
      name: "Starter",
      price: "₹999",
      period: "/ mo",
      limit: "Up to 5 Services",
      desc: "For small teams and microservices getting started with unified observability.",
      features: [
        "Up to 5 monitored microservices",
        "Unified Ops Dashboard",
        "Prometheus & Loki ingestion",
        "Email incident notifications",
        "Standard metric retention (7 days)",
      ],
    },
    {
      id: "PROFESSIONAL" as PlanTier,
      name: "Professional",
      price: "₹4,999",
      period: "/ mo",
      limit: "Up to 50 Services",
      desc: "Autonomous AI root cause analysis and multi-channel alerting for fast-moving engineering teams.",
      popular: true,
      features: [
        "Up to 50 monitored microservices",
        "Autonomous AI Root Cause Engine",
        "3-Sigma Statistical Anomaly Detection",
        "Slack & Microsoft Teams alerts",
        "Plain-English Log Explainer",
        "30-day telemetry retention",
      ],
    },
    {
      id: "ENTERPRISE" as PlanTier,
      name: "Enterprise",
      price: "₹19,999",
      period: "/ mo",
      limit: "Unlimited Services",
      desc: "Distributed tracing, autonomous postmortem generator, and custom webhook dispatchers.",
      features: [
        "Unlimited monitored services",
        "OpenTelemetry trace correlation",
        "Autonomous Postmortem Generator",
        "Custom webhooks (PagerDuty / Opsgenie)",
        "90-day high-resolution retention",
        "Dedicated SRE support & 99.9% uptime SLA",
      ],
    },
  ];

  const currentTier = sub?.planTier || "STARTER";
  const usedServices = sub?.servicesCount || 0;
  const maxServices = sub?.maxServices || 5;
  const usagePercentage = Math.min(100, Math.round((usedServices / (maxServices === 10000 ? 50 : maxServices)) * 100));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">
            <CreditCard size={22} /> Subscription Plans & Capacity
          </h1>
          <p className="page-sub">
            Capacity-based transparent pricing. No per-seat developer tax.
          </p>
        </div>

        <span className="badge" style={{ fontSize: 13, padding: "6px 14px", background: "rgba(139,92,246,0.15)", color: "var(--ai-purple-light)" }}>
          Active Tier: {sub?.planName || currentTier}
        </span>
      </div>

      {successMessage && (
        <div className="card" style={{ borderLeft: "4px solid var(--ok)", padding: "12px 16px", margin: "16px 0", background: "rgba(16,185,129,0.08)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#34d399" }}>{successMessage}</span>
        </div>
      )}

      {/* Active Capacity Gauge Card */}
      <div className="card" style={{ marginTop: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "#fff" }}>
            Active Service Capacity: <span style={{ color: "var(--cyan-neon)" }}>{usedServices}</span> / {maxServices === 10000 ? "Unlimited" : maxServices} services
          </div>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Workspace: <strong style={{ color: "#fff" }}>{sub?.organizationName}</strong>
          </span>
        </div>

        <div style={{ width: "100%", height: 10, background: "var(--bg-inset)", borderRadius: 5, overflow: "hidden", border: "1px solid var(--border-card)" }}>
          <div
            style={{
              width: `${usagePercentage}%`,
              height: "100%",
              background: usagePercentage > 85 ? "var(--down)" : "linear-gradient(90deg, #6366f1 0%, #00d2ff 100%)",
              borderRadius: 5,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Plan Tiers Matrix */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 18 }}>
        {tiers.map((t) => {
          const isCurrent = currentTier === t.id;

          return (
            <div
              key={t.id}
              className="card"
              style={{
                position: "relative",
                border: isCurrent ? "2px solid var(--ai-purple)" : t.popular ? "1px solid rgba(139,92,246,0.4)" : "1px solid var(--border-card)",
                display: "flex",
                flexDirection: "column",
                background: isCurrent ? "rgba(20,27,45,0.9)" : "var(--bg-card)",
              }}
            >
              {t.popular && (
                <span
                  style={{
                    position: "absolute",
                    top: -11,
                    right: 18,
                    background: "var(--ai-gradient)",
                    color: "#fff",
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Most Popular
                </span>
              )}

              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{t.name}</div>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", minHeight: 40, margin: "0 0 14px", lineHeight: 1.5 }}>
                {t.desc}
              </p>

              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{t.price}</span>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t.period}</span>
              </div>

              <div className="badge" style={{ width: "fit-content", fontSize: 11.5, marginBottom: 18, fontWeight: 700 }}>
                {t.limit}
              </div>

              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16, marginBottom: 22, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 10, textTransform: "uppercase" }}>
                  Features Included:
                </div>
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 13, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 8 }}>
                  {t.features.map((feat, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle size={14} color="var(--ok)" style={{ flexShrink: 0 }} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                className={`btn ${isCurrent ? "secondary" : "primary"}`}
                disabled={isCurrent || switchingTier === t.id || user?.role !== "ADMIN"}
                onClick={() => handleSwitchTier(t.id)}
                style={{ width: "100%", padding: "10px", fontSize: 13 }}
              >
                {isCurrent ? "Active Plan" : switchingTier === t.id ? "Switching..." : `Switch to ${t.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
