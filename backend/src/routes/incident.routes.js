const express = require("express");
const { z } = require("zod");
const prisma = require("../utils/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { generateRootCauseReport } = require("../services/aiRootCause");
const { generatePostmortemMarkdown } = require("../services/postmortemAgent");

const router = express.Router();
router.use(requireAuth);

// List incidents for the current organization
router.get("/", async (req, res, next) => {
  try {
    const { status, serviceId, severity } = req.query;
    const where = {
      service: { organizationId: req.user.organizationId },
    };

    if (status && ["OPEN", "INVESTIGATING", "RESOLVED"].includes(String(status).toUpperCase())) {
      where.status = String(status).toUpperCase();
    }
    if (serviceId) {
      where.serviceId = String(serviceId);
    }
    if (severity) {
      where.severity = String(severity).toUpperCase();
    }

    const incidents = await prisma.incident.findMany({
      where,
      include: { service: true, alerts: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const parsed = incidents.map(normalizeIncident);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

// Single incident with detailed telemetry snapshots and postmortem
router.get("/:id", async (req, res, next) => {
  try {
    const incident = await prisma.incident.findFirst({
      where: {
        id: req.params.id,
        service: { organizationId: req.user.organizationId },
      },
      include: {
        service: true,
        alerts: { orderBy: { sentAt: "desc" } },
      },
    });

    if (!incident) return res.status(404).json({ error: "Incident not found in organization" });
    res.json(normalizeIncident(incident));
  } catch (err) {
    next(err);
  }
});

// Export full markdown postmortem
router.get("/:id/postmortem", async (req, res, next) => {
  try {
    const incident = await prisma.incident.findFirst({
      where: {
        id: req.params.id,
        service: { organizationId: req.user.organizationId },
      },
      include: { service: true },
    });

    if (!incident) return res.status(404).json({ error: "Incident not found in organization" });

    let markdown = incident.postmortemDraft;
    if (!markdown) {
      const rawContext = parseJsonSafe(incident.rawContext);
      markdown = generatePostmortemMarkdown({
        incident,
        service: incident.service,
        metrics: rawContext?.metricsSnapshot || [],
        logs: rawContext?.logsSnapshot || [],
        traces: rawContext?.tracesSnapshot || [],
        anomaly: rawContext?.anomaly || {},
      });
    }

    res.json({
      incidentId: incident.id,
      postmortemMarkdown: markdown,
    });
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED"]),
});

// Update incident status
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status } = statusSchema.parse(req.body);

    const incident = await prisma.incident.findFirst({
      where: { id: req.params.id, service: { organizationId: req.user.organizationId } },
    });
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    const updated = await prisma.incident.update({
      where: { id: incident.id },
      data: {
        status,
        resolvedAt: status === "RESOLVED" ? new Date() : null,
      },
      include: { service: true, alerts: true },
    });

    // Update service health status accordingly
    if (status === "RESOLVED") {
      const otherOpen = await prisma.incident.count({
        where: {
          serviceId: incident.serviceId,
          status: { not: "RESOLVED" },
          id: { not: incident.id },
        },
      });
      if (otherOpen === 0) {
        await prisma.service.update({
          where: { id: incident.serviceId },
          data: { status: "HEALTHY" },
        });
      }
    } else {
      await prisma.service.update({
        where: { id: incident.serviceId },
        data: { status: "DEGRADED" },
      });
    }

    res.json(normalizeIncident(updated));
  } catch (err) {
    next(err);
  }
});

// Convenience resolve endpoint
router.patch("/:id/resolve", async (req, res, next) => {
  try {
    const incident = await prisma.incident.findFirst({
      where: { id: req.params.id, service: { organizationId: req.user.organizationId } },
    });
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    const updated = await prisma.incident.update({
      where: { id: incident.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
      include: { service: true, alerts: true },
    });

    await prisma.service.update({
      where: { id: incident.serviceId },
      data: { status: "HEALTHY" },
    });

    res.json(normalizeIncident(updated));
  } catch (err) {
    next(err);
  }
});

// Re-run AI analysis on demand
router.post("/:id/analyze", async (req, res, next) => {
  try {
    const incident = await prisma.incident.findFirst({
      where: { id: req.params.id, service: { organizationId: req.user.organizationId } },
      include: { service: true },
    });
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    const rawContext = parseJsonSafe(incident.rawContext);
    const [metrics, logs, traces] = await Promise.all([
      prisma.metric.findMany({ where: { serviceId: incident.serviceId }, take: 20, orderBy: { timestamp: "desc" } }),
      prisma.logEntry.findMany({ where: { serviceId: incident.serviceId }, take: 25, orderBy: { timestamp: "desc" } }),
      prisma.traceSpan.findMany({ where: { serviceId: incident.serviceId }, take: 15, orderBy: { timestamp: "desc" } }),
    ]);

    const report = await generateRootCauseReport({
      service: incident.service,
      metrics: metrics.length > 0 ? metrics : rawContext?.metricsSnapshot || [],
      logs: logs.length > 0 ? logs : rawContext?.logsSnapshot || [],
      traces: traces.length > 0 ? traces : rawContext?.tracesSnapshot || [],
      anomaly: rawContext?.anomaly || { observedValue: 1850, baselineMean: 200, deviationStdDevs: 270 },
    });

    const updated = await prisma.incident.update({
      where: { id: incident.id },
      data: {
        whatFailed: report.whatFailed,
        whyReason: report.whyReason,
        impact: report.impact,
        suggestedFix: report.suggestedFix,
        confidence: report.confidence,
        timeToRootCauseSeconds: report.timeToRootCauseSeconds,
        correlatedSignals: typeof report.correlatedSignals === "string" ? report.correlatedSignals : JSON.stringify(report.correlatedSignals),
        postmortemDraft: report.postmortemDraft,
      },
      include: { service: true, alerts: true },
    });

    res.json(normalizeIncident(updated));
  } catch (err) {
    next(err);
  }
});

function parseJsonSafe(data) {
  if (!data) return null;
  if (typeof data === "object") return data;
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

function normalizeIncident(incident) {
  const rawContext = parseJsonSafe(incident.rawContext);
  const correlatedSignals = parseJsonSafe(incident.correlatedSignals) || [];

  return {
    ...incident,
    rawContext,
    correlatedSignals,
    correlated_signals: correlatedSignals,
    what_failed: incident.whatFailed,
    why: incident.whyReason,
    time_to_root_cause_seconds: incident.timeToRootCauseSeconds,
    postmortem_draft: incident.postmortemDraft,
  };
}

module.exports = router;
