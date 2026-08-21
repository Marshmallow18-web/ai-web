const express = require("express");
const { z } = require("zod");
const prisma = require("../utils/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendSlack, sendTeams, sendEmail, sendWebhook } = require("../services/alertEngine");

const router = express.Router();
router.use(requireAuth);

// List all dispatched alerts for the organization's incidents
router.get("/", async (req, res, next) => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { incident: { service: { organizationId: req.user.organizationId } } },
      include: {
        incident: {
          include: {
            service: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 100,
    });
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

// List configured alert channels for the organization
router.get("/configs", async (req, res, next) => {
  try {
    const configs = await prisma.alertConfig.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { createdAt: "asc" },
    });
    res.json(configs);
  } catch (err) {
    next(err);
  }
});

const alertConfigSchema = z.object({
  channel: z.enum(["EMAIL", "SLACK", "TEAMS", "WEBHOOK"]),
  target: z.string().min(1),
  enabled: z.boolean().optional().default(true),
});

// Add / update alert channel config
router.post("/configs", requireRole("ADMIN", "DEVOPS_ENGINEER"), async (req, res, next) => {
  try {
    const data = alertConfigSchema.parse(req.body);

    const config = await prisma.alertConfig.create({
      data: {
        organizationId: req.user.organizationId,
        channel: data.channel,
        target: data.target,
        enabled: data.enabled,
      },
    });

    res.status(201).json(config);
  } catch (err) {
    next(err);
  }
});

// Delete alert channel config
router.delete("/configs/:id", requireRole("ADMIN", "DEVOPS_ENGINEER"), async (req, res, next) => {
  try {
    const config = await prisma.alertConfig.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!config) return res.status(404).json({ error: "Alert config not found" });

    await prisma.alertConfig.delete({ where: { id: config.id } });
    res.json({ message: "Alert channel removed successfully" });
  } catch (err) {
    next(err);
  }
});

// Send a test alert to verify notification channel connectivity
router.post("/test", requireRole("ADMIN", "DEVOPS_ENGINEER"), async (req, res, next) => {
  try {
    const { channel, target } = req.body;
    const testIncident = {
      id: "test_incident",
      service: { name: "Test Service (Verification)" },
      whatFailed: "Synthetic Test Alert from DevSight AI",
      whyReason: "Verification ping triggered manually by admin to test alert delivery pipeline.",
      impact: "Zero production impact. All systems normal.",
      suggestedFix: "No action required.",
      severity: "INFO",
      timeToRootCauseSeconds: 0.8,
      confidence: 1.0,
      createdAt: new Date(),
    };

    let result = { success: true };
    const normalized = String(channel || "SLACK").toUpperCase();

    if (normalized === "SLACK") result = await sendSlack(testIncident, target);
    else if (normalized === "TEAMS") result = await sendTeams(testIncident, target);
    else if (normalized === "EMAIL") result = await sendEmail(testIncident, target);
    else if (normalized === "WEBHOOK") result = await sendWebhook(testIncident, target);

    res.json({ status: "test_alert_sent", channel: normalized, result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
