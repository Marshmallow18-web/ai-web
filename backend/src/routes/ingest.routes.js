const express = require("express");
const { z } = require("zod");
const prisma = require("../utils/prisma");
const { requireAuth } = require("../middleware/auth");
const { recordMetricAndCheck } = require("../services/anomalyDetection");
const { triggerIncidentAnalysis } = require("../services/incidentTrigger");

const router = express.Router();
router.use(requireAuth);

/**
 * Helper to resolve service by ID or name within user's organization.
 */
async function resolveService(orgId, serviceIdentifier) {
  if (!serviceIdentifier) return null;
  return await prisma.service.findFirst({
    where: {
      organizationId: orgId,
      OR: [
        { id: String(serviceIdentifier) },
        { name: { equals: String(serviceIdentifier) } },
      ],
    },
  });
}

// -------------------------------------------------------------
// 1. PROMETHEUS INGESTION (remote_write & batch metrics)
// -------------------------------------------------------------
router.post("/prometheus", async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const body = req.body;
    const results = [];
    const anomalies = [];

    // Format A: Prometheus timeseries JSON payload
    if (body.timeseries && Array.isArray(body.timeseries)) {
      for (const ts of body.timeseries) {
        const labels = ts.labels || {};
        const metricName = labels.__name__ || labels.metric_name || "latency_ms";
        const serviceName = labels.service || labels.app || labels.job;

        const service = await resolveService(orgId, serviceName);
        if (!service) continue;

        for (const sample of ts.samples || []) {
          const val = Number(sample.value);
          const anomaly = await recordMetricAndCheck(service.id, metricName, val, labels);

          if (anomaly.isAnomaly && anomaly.shouldTriggerIncident) {
            const incident = await triggerIncidentAnalysis(service, anomaly).catch((err) => {
              console.error("[ingest/prometheus] Incident trigger failed:", err);
              return null;
            });
            anomalies.push({ serviceId: service.id, anomaly, incident });
          }
          results.push({ serviceId: service.id, metric: metricName, value: val });
        }
      }
    } else if (body.serviceId || body.serviceName) {
      // Format B: Direct batch payload
      const service = await resolveService(orgId, body.serviceId || body.serviceName);
      if (!service) return res.status(404).json({ error: "Service not found in organization" });

      const metricsList = Array.isArray(body.metrics) ? body.metrics : [{ name: body.name || "latency_ms", value: body.value }];

      for (const m of metricsList) {
        const anomaly = await recordMetricAndCheck(service.id, m.name || "latency_ms", Number(m.value), m.labels);
        if (anomaly.isAnomaly && anomaly.shouldTriggerIncident) {
          const incident = await triggerIncidentAnalysis(service, anomaly).catch((err) => {
            console.error("[ingest/prometheus] Incident trigger failed:", err);
            return null;
          });
          anomalies.push({ serviceId: service.id, anomaly, incident });
        }
        results.push({ serviceId: service.id, name: m.name, value: m.value });
      }
    }

    res.status(202).json({
      status: "success",
      ingestedCount: results.length,
      anomaliesDetected: anomalies.length,
      anomalies,
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 2. OPENTELEMETRY (OTLP) TRACES & SPANS INGESTION
// -------------------------------------------------------------
router.post(["/otlp/v1/traces", "/v1/traces"], async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const body = req.body;
    const ingestedSpans = [];

    // OTLP JSON resourceSpans format
    if (body.resourceSpans && Array.isArray(body.resourceSpans)) {
      for (const rs of body.resourceSpans) {
        // Extract service name from resource attributes
        const resAttrs = rs.resource?.attributes || [];
        const svcAttr = resAttrs.find((a) => a.key === "service.name" || a.key === "service");
        const serviceName = svcAttr?.value?.stringValue || svcAttr?.value || "Default Service";

        let service = await resolveService(orgId, serviceName);
        if (!service) {
          // Auto-create service if it doesn't exist yet
          service = await prisma.service.create({
            data: {
              name: String(serviceName),
              organizationId: orgId,
              status: "HEALTHY",
              baselineMs: 150,
            },
          });
        }

        for (const scopeSpan of rs.scopeSpans || []) {
          for (const span of scopeSpan.spans || []) {
            const startNano = BigInt(span.startTimeUnixNano || "0");
            const endNano = BigInt(span.endTimeUnixNano || "0");
            const durationMs = endNano > startNano ? Number(endNano - startNano) / 1e6 : (Number(span.durationMs) || 50);

            const statusCode = span.status?.code === 2 || span.status?.code === "STATUS_CODE_ERROR" || span.status?.code === "ERROR" ? "ERROR" : "OK";

            const traceSpan = await prisma.traceSpan.create({
              data: {
                serviceId: service.id,
                traceId: span.traceId || `trace_${Date.now()}`,
                spanId: span.spanId || `span_${Date.now()}`,
                parentSpanId: span.parentSpanId || null,
                name: span.name || "HTTP request",
                durationMs: Math.round(durationMs * 10) / 10,
                statusCode,
                error: span.status?.message || null,
                attributes: span.attributes ? JSON.stringify(span.attributes) : null,
              },
            });

            ingestedSpans.push(traceSpan);
          }
        }
      }
    } else if (body.spans && Array.isArray(body.spans)) {
      // Simplified JSON traces format
      for (const span of body.spans) {
        const service = await resolveService(orgId, span.serviceId || span.serviceName);
        if (!service) continue;

        const traceSpan = await prisma.traceSpan.create({
          data: {
            serviceId: service.id,
            traceId: span.traceId || `trace_${Date.now()}`,
            spanId: span.spanId || `span_${Date.now()}`,
            parentSpanId: span.parentSpanId || null,
            name: span.name || "HTTP Request",
            durationMs: Number(span.durationMs || 50),
            statusCode: span.statusCode || "OK",
            error: span.error || null,
          },
        });
        ingestedSpans.push(traceSpan);
      }
    }

    res.status(202).json({
      status: "success",
      ingestedSpansCount: ingestedSpans.length,
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// 3. LOKI & STRUCTURED LOG STREAM INGESTION
// -------------------------------------------------------------
router.post(["/loki", "/loki/api/v1/push"], async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const body = req.body;
    let createdCount = 0;

    if (body.streams && Array.isArray(body.streams)) {
      for (const stream of body.streams) {
        const labels = stream.stream || {};
        const serviceName = labels.app || labels.service || labels.job || "Application";
        const level = (labels.level || "info").toLowerCase();

        let service = await resolveService(orgId, serviceName);
        if (!service) {
          service = await prisma.service.create({
            data: {
              name: String(serviceName),
              organizationId: orgId,
              status: "HEALTHY",
              baselineMs: 120,
            },
          });
        }

        const logEntries = [];
        for (const val of stream.values || []) {
          // Loki value format: [ timestamp_nano_str, log_message_str ]
          const timestampNano = val[0];
          const logMessage = val[1] || "";
          const timestamp = timestampNano ? new Date(Number(BigInt(timestampNano) / BigInt(1e6))) : new Date();

          logEntries.push({
            serviceId: service.id,
            level: level.includes("err") ? "error" : level.includes("warn") ? "warn" : "info",
            message: String(logMessage),
            attributes: JSON.stringify(labels),
            timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
          });
        }

        if (logEntries.length > 0) {
          await prisma.logEntry.createMany({ data: logEntries });
          createdCount += logEntries.length;
        }
      }
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
