require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const prisma = require("./utils/prisma");

const authRoutes = require("./routes/auth.routes");
const ingestRoutes = require("./routes/ingest.routes");
const serviceRoutes = require("./routes/service.routes");
const metricRoutes = require("./routes/metric.routes");
const logRoutes = require("./routes/log.routes");
const incidentRoutes = require("./routes/incident.routes");
const alertRoutes = require("./routes/alert.routes");
const billingRoutes = require("./routes/billing.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "15mb" })); // Generous limit for bulk log uploads & OTLP batches
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Global rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: "Too many requests from this IP, please try again later." },
  })
);

// Liveness & Readiness Probes
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "devsight-ai-backend",
    version: "1.0.0",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Self-monitoring Prometheus scrape endpoint
app.get("/metrics", async (req, res) => {
  try {
    const [servicesCount, incidentsCount, logsCount, metricsCount] = await Promise.all([
      prisma.service.count().catch(() => 0),
      prisma.incident.count({ where: { status: { not: "RESOLVED" } } }).catch(() => 0),
      prisma.logEntry.count().catch(() => 0),
      prisma.metric.count().catch(() => 0),
    ]);

    const mem = process.memoryUsage();
    const metricsOutput = `
# HELP devsight_uptime_seconds Process uptime in seconds
# TYPE devsight_uptime_seconds gauge
devsight_uptime_seconds ${process.uptime()}

# HELP devsight_process_heap_bytes Process heap memory usage in bytes
# TYPE devsight_process_heap_bytes gauge
devsight_process_heap_bytes ${mem.heapUsed}

# HELP devsight_monitored_services_total Total registered monitored services
# TYPE devsight_monitored_services_total gauge
devsight_monitored_services_total ${servicesCount}

# HELP devsight_open_incidents_total Total active open incidents
# TYPE devsight_open_incidents_total gauge
devsight_open_incidents_total ${incidentsCount}

# HELP devsight_ingested_logs_total Total ingested log entries
# TYPE devsight_ingested_logs_total counter
devsight_ingested_logs_total ${logsCount}

# HELP devsight_ingested_metrics_total Total ingested telemetry metrics
# TYPE devsight_ingested_metrics_total counter
devsight_ingested_metrics_total ${metricsCount}
`.trim();

    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(metricsOutput);
  } catch (err) {
    res.status(500).send("# Error collecting self metrics");
  }
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/ingest", ingestRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/metrics", metricRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Direct OTLP and Loki alias endpoints (for standard agent configs)
app.use("/v1/traces", ingestRoutes);
app.use("/loki/api/v1/push", ingestRoutes);

// Centralized error handling
app.use((err, req, res, next) => {
  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "Validation error",
      details: err.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    });
  }

  console.error("[devsight-backend] Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 DevSight AI backend running on port ${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ Port ${PORT} is already in use by another process.`);
      console.error(`Run this command in PowerShell to free up port ${PORT}:`);
      console.error(`  Get-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess | Stop-Process -Force\n`);
    } else {
      console.error("Server error:", err);
    }
  });
}

module.exports = app;
