const express = require("express");
const prisma = require("../utils/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// Aggregated Ops Dashboard endpoint
router.get("/", async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;

    const [services, openIncidents, recentIncidents, recentAlerts, org] = await Promise.all([
      prisma.service.findMany({
        where: { organizationId: orgId },
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
      }),
      prisma.incident.count({
        where: { service: { organizationId: orgId }, status: { not: "RESOLVED" } },
      }),
      prisma.incident.findMany({
        where: { service: { organizationId: orgId } },
        include: { service: true, alerts: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.alert.findMany({
        where: { incident: { service: { organizationId: orgId } } },
        include: { incident: { select: { id: true, whatFailed: true, service: true } } },
        orderBy: { sentAt: "desc" },
        take: 6,
      }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, planTier: true, apiKey: true },
      }),
    ]);

    const statusCounts = services.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});

    const parsedIncidents = recentIncidents.map((i) => {
      let rawContext = null;
      let correlatedSignals = [];
      try {
        rawContext = typeof i.rawContext === "string" ? JSON.parse(i.rawContext) : i.rawContext;
      } catch (e) {}
      try {
        correlatedSignals = typeof i.correlatedSignals === "string" ? JSON.parse(i.correlatedSignals) : (i.correlatedSignals || []);
      } catch (e) {}

      return {
        ...i,
        rawContext,
        correlatedSignals,
        correlated_signals: correlatedSignals,
        what_failed: i.whatFailed,
        why: i.whyReason,
        time_to_root_cause_seconds: i.timeToRootCauseSeconds,
        postmortem_draft: i.postmortemDraft,
      };
    });

    res.json({
      organization: org,
      totalServices: services.length,
      statusCounts,
      openIncidentCount: openIncidents,
      services,
      recentIncidents: parsedIncidents,
      recentAlerts,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
