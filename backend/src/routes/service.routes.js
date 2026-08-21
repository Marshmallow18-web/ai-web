const express = require("express");
const { z } = require("zod");
const prisma = require("../utils/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { checkServiceLimit } = require("../middleware/billing");

const router = express.Router();
router.use(requireAuth);

// List all services in the user's organization
router.get("/", async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      where: { organizationId: req.user.organizationId },
      include: {
        _count: {
          select: {
            incidents: { where: { status: { not: "RESOLVED" } } },
            metrics: true,
            logs: true,
            traces: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json(services);
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  baselineMs: z.number().optional().default(120),
});

// Register a new service (enforces RBAC + plan tier limit)
router.post("/", requireRole("ADMIN", "DEVOPS_ENGINEER"), checkServiceLimit, async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    const existing = await prisma.service.findFirst({
      where: { name: data.name, organizationId: req.user.organizationId },
    });
    if (existing) {
      return res.status(409).json({ error: `Service with name '${data.name}' already exists in your organization` });
    }

    const service = await prisma.service.create({
      data: {
        name: data.name,
        baselineMs: data.baselineMs,
        status: "HEALTHY",
        organizationId: req.user.organizationId,
      },
    });

    // Seed baseline historical metrics so anomaly detector has statistical context
    const now = Date.now();
    const baseline = data.baselineMs || 120;
    const initialMetrics = [];
    for (let i = 0; i < 25; i++) {
      const jitter = (Math.random() * 0.1 - 0.05) * baseline;
      initialMetrics.push({
        serviceId: service.id,
        name: "latency_ms",
        value: Math.round((baseline + jitter) * 10) / 10,
        timestamp: new Date(now - (25 - i) * 60000),
      });
    }
    await prisma.metric.createMany({ data: initialMetrics });

    await prisma.logEntry.create({
      data: {
        serviceId: service.id,
        level: "info",
        message: `Service registered to DevSight monitoring. Baseline calibrated at ${baseline}ms.`,
      },
    });

    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
});

// Get single service details
router.get("/:id", async (req, res, next) => {
  try {
    const service = await prisma.service.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: {
        incidents: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: { metrics: true, logs: true, traces: true },
        },
      },
    });
    if (!service) return res.status(404).json({ error: "Service not found in organization" });

    const recentMetrics = await prisma.metric.findMany({
      where: { serviceId: service.id },
      orderBy: { timestamp: "desc" },
      take: 40,
    });

    const recentTraces = await prisma.traceSpan.findMany({
      where: { serviceId: service.id },
      orderBy: { timestamp: "desc" },
      take: 15,
    });

    res.json({ ...service, recentMetrics, recentTraces });
  } catch (err) {
    next(err);
  }
});

// Delete a service (cascade removes associated logs, metrics, traces, alerts, and incidents)
router.delete("/:id", requireRole("ADMIN", "DEVOPS_ENGINEER"), async (req, res, next) => {
  try {
    const service = await prisma.service.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!service) return res.status(404).json({ error: "Service not found in organization" });

    const incidentIds = (
      await prisma.incident.findMany({
        where: { serviceId: service.id },
        select: { id: true },
      })
    ).map((i) => i.id);

    if (incidentIds.length > 0) {
      await prisma.alert.deleteMany({ where: { incidentId: { in: incidentIds } } });
      await prisma.incident.deleteMany({ where: { id: { in: incidentIds } } });
    }

    await prisma.metric.deleteMany({ where: { serviceId: service.id } });
    await prisma.logEntry.deleteMany({ where: { serviceId: service.id } });
    await prisma.traceSpan.deleteMany({ where: { serviceId: service.id } });
    await prisma.service.delete({ where: { id: service.id } });

    res.json({ message: "Service and associated telemetry deleted successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
