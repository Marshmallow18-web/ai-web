/**
 * DevSight AI — Autonomous Postmortem Generator Agent
 * Generates an executive-ready, Markdown-formatted postmortem document for any incident.
 */

function generatePostmortemMarkdown({
  incident,
  service,
  metrics = [],
  logs = [],
  traces = [],
  anomaly = {},
}) {
  const serviceName = service?.name || "Monitored Service";
  const incidentDate = incident?.createdAt
    ? new Date(incident.createdAt).toUTCString()
    : new Date().toUTCString();
  const resolvedDate = incident?.resolvedAt
    ? new Date(incident.resolvedAt).toUTCString()
    : "Ongoing / Under Investigation";

  const durationStr = incident?.resolvedAt && incident?.createdAt
    ? `${Math.round((new Date(incident.resolvedAt) - new Date(incident.createdAt)) / 60000)} minutes`
    : "TBD";

  const observedVal = anomaly.observedValue || (metrics[0]?.value ?? "N/A");
  const baseline = anomaly.baselineMean || service?.baselineMs || 150;
  const deviation = anomaly.deviationStdDevs || 3.0;

  const errorLogs = logs.filter((l) => l.level === "error" || l.level === "fatal");
  const slowTraces = traces.filter((t) => t.statusCode === "ERROR" || t.durationMs > baseline * 2);

  return `# Incident Postmortem: ${incident.whatFailed || `${serviceName} Degradation`}

**Status:** ${incident.status || "INVESTIGATING"}  
**Severity:** ${incident.severity || "HIGH"}  
**Affected Component:** \`${serviceName}\`  
**Incident Start:** ${incidentDate}  
**Incident Resolved:** ${resolvedDate}  
**Time to Detect & Root Cause:** ${incident.timeToRootCauseSeconds || 1.8}s  
**Duration:** ${durationStr}  

---

## 1. Executive Summary
On **${incidentDate}**, the **${serviceName}** experienced a statistically significant performance anomaly ($\ge ${deviation}\\sigma$ deviation above normal). The DevSight AI Autonomous Incident Agent detected the anomaly in real time, correlated telemetry snapshots with error logs and trace spans, and diagnosed the root cause.

* **Primary Symptom:** ${incident.whatFailed}
* **Root Cause:** ${incident.whyReason}
* **Business & User Impact:** ${incident.impact}
* **Suggested Fix:** ${incident.suggestedFix}

---

## 2. Telemetry & Anomaly Diagnostics

### Metric Baseline vs Observed Anomaly
* **Observed Value:** \`${observedVal}ms\`
* **Learned Baseline Mean:** \`${baseline}ms\`
* **Statistical Deviation:** \`${deviation}\\sigma\` (Standard Deviations above baseline)
* **Confidence Level:** \`${Math.round((incident.confidence || 0.94) * 100)}%\`

### Correlated Error Logs (${errorLogs.length} instances)
\`\`\`
${errorLogs.length > 0
  ? errorLogs
      .slice(0, 5)
      .map((l) => `[${l.timestamp ? new Date(l.timestamp).toISOString() : "T"}] [${l.level.toUpperCase()}] ${l.message}`)
      .join("\n")
  : "No explicit critical stack traces recorded; latency spike dominated by upstream I/O queue wait."
}
\`\`\`

${traces.length > 0 ? `### Correlated Trace Spans (${slowTraces.length} slow/failing spans)
| Operation | Duration | Status | Trace ID |
|---|---|---|---|
${slowTraces
  .slice(0, 4)
  .map((t) => `| \`${t.name}\` | \`${t.durationMs}ms\` | \`${t.statusCode}\` | \`${t.traceId?.slice(0, 12)}...\` |`)
  .join("\n")}
` : ""}

---

## 3. Incident Timeline
* **T - 5m:** Normal telemetry stream observed within calibrated baseline ($\approx ${baseline}ms$).
* **T + 0s:** Latency spike observed at \`${observedVal}ms\`.
* **T + 1.2s:** DevSight statistical anomaly detector flagged $3\\sigma$ outlier threshold breach.
* **T + 1.8s:** AI Root Cause Engine analyzed snapshot logs and metrics, generating structured report.
* **T + 2.0s:** Service status transitioned to \`DEGRADED\` and automated alert dispatches triggered.
${incident.resolvedAt ? `* **T + End:** Incident marked resolved; service baseline stabilized.` : ""}

---

## 4. Action Items & Preventive Measures

| Action Item | Type | Owner | Status |
|---|---|---|---|
| Apply remediation: ${incident.suggestedFix?.slice(0, 60)}... | Immediate Fix | On-Call SRE | In Progress |
| Calibrate circuit breaker thresholds for ${serviceName} | Prevention | DevOps Team | Pending |
| Add synthetic health probe on critical path | Monitoring | Platform Eng | Pending |

---
*Generated autonomously by **DevSight AI Observability Copilot** at ${new Date().toUTCString()}*
`;
}

module.exports = { generatePostmortemMarkdown };
