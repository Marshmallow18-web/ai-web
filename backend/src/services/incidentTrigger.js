const prisma = require("../utils/prisma");
const { generateRootCauseReport } = require("./aiRootCause");
const { dispatchAlerts } = require("./alertEngine");

/**
 * Autonomous AI Incident Agent: correlates telemetry, diagnoses root cause,
 * persists the incident, and fires multi-channel notifications.
 * @param {object} service - The affected Service record
 * @param {object} anomaly - Statistical anomaly detection outcome
 */
async function triggerIncidentAnalysis(service, anomaly) {
  // Pull correlated telemetry window in parallel
  const [metrics, logs, traces] = await Promise.all([
    prisma.metric.findMany({
      where: { serviceId: service.id },
      orderBy: { timestamp: "desc" },
      take: 25,
    }),
    prisma.logEntry.findMany({
      where: { serviceId: service.id },
      orderBy: { timestamp: "desc" },
      take: 35,
    }),
    prisma.traceSpan.findMany({
      where: { serviceId: service.id },
      orderBy: { timestamp: "desc" },
      take: 20,
    }),
  ]);

  const report = await generateRootCauseReport({
    service,
    metrics,
    logs,
    traces,
    anomaly,
  });

  const rawContextData = {
    anomaly,
    metricsSnapshot: metrics.slice(0, 10),
    logsSnapshot: logs.slice(0, 10),
    tracesSnapshot: traces.slice(0, 10),
    audit: report.audit,
  };

  const incident = await prisma.incident.create({
    data: {
      serviceId: service.id,
      status: "OPEN",
      severity: anomaly.severity || "HIGH",
      whatFailed: report.whatFailed,
      whyReason: report.whyReason,
      impact: report.impact,
      suggestedFix: report.suggestedFix,
      confidence: report.confidence,
      timeToRootCauseSeconds: report.timeToRootCauseSeconds,
      correlatedSignals: typeof report.correlatedSignals === "string" ? report.correlatedSignals : JSON.stringify(report.correlatedSignals),
      postmortemDraft: report.postmortemDraft,
      rawContext: typeof rawContextData === "string" ? rawContextData : JSON.stringify(rawContextData),
    },
    include: { service: true },
  });

  // Transition service health status to DEGRADED
  await prisma.service.update({
    where: { id: service.id },
    data: { status: "DEGRADED" },
  });

  // Query organization's configured alert channels
  const alertConfigs = await prisma.alertConfig.findMany({
    where: { organizationId: service.organizationId, enabled: true },
  });

  const channelsToDispatch = alertConfigs.length > 0
    ? alertConfigs.map((c) => c.channel)
    : ["SLACK", "EMAIL", "TEAMS"];

  // Dispatch alerts asynchronously without blocking response
  dispatchAlerts(incident, channelsToDispatch, alertConfigs).catch((err) => {
    console.error("[incidentTrigger] Alert dispatch failed:", err);
  });

  return incident;
}

module.exports = { triggerIncidentAnalysis };
