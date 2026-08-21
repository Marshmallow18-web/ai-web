const prisma = require("../utils/prisma");

const PLAN_LIMITS = {
  STARTER: {
    maxServices: 5,
    features: ["DASHBOARD", "METRICS_INGEST", "LOGS_VIEW"],
    priceInr: 999,
    priceUsd: 12,
    name: "Starter",
  },
  PROFESSIONAL: {
    maxServices: 50,
    features: ["DASHBOARD", "METRICS_INGEST", "LOGS_VIEW", "AI_ROOT_CAUSE", "ALERTS_SLACK_TEAMS", "LOG_EXPLAINER"],
    priceInr: 4999,
    priceUsd: 59,
    name: "Professional",
  },
  ENTERPRISE: {
    maxServices: 10000, // Unlimited
    features: [
      "DASHBOARD",
      "METRICS_INGEST",
      "LOGS_VIEW",
      "AI_ROOT_CAUSE",
      "ALERTS_SLACK_TEAMS",
      "LOG_EXPLAINER",
      "OTEL_TRACES",
      "POSTMORTEM_GENERATOR",
      "CUSTOM_WEBHOOKS",
      "DEDICATED_SUPPORT",
    ],
    priceInr: 19999,
    priceUsd: 249,
    name: "Enterprise",
  },
};

// Check if org has capacity to add a new service
async function checkServiceLimit(req, res, next) {
  try {
    const orgId = req.user.organizationId;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: { services: true },
        },
      },
    });

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const tier = (org.planTier || "STARTER").toUpperCase();
    const limit = PLAN_LIMITS[tier]?.maxServices || 5;

    if (org._count.services >= limit) {
      return res.status(403).json({
        error: `Service limit reached for plan '${tier}' (${org._count.services}/${limit} services). Upgrade to a higher plan to add more services.`,
        currentCount: org._count.services,
        limit,
        planTier: tier,
      });
    }

    req.organizationTier = tier;
    next();
  } catch (err) {
    next(err);
  }
}

// Gate specific features by plan tier
function requirePlanFeature(featureName) {
  return async (req, res, next) => {
    try {
      const orgId = req.user.organizationId;
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      const tier = (org?.planTier || req.user.planTier || "STARTER").toUpperCase();
      const allowedFeatures = PLAN_LIMITS[tier]?.features || PLAN_LIMITS.STARTER.features;

      if (!allowedFeatures.includes(featureName)) {
        return res.status(403).json({
          error: `Feature '${featureName}' requires an upgrade. Current tier: '${tier}'.`,
          requiredTier: featureName === "OTEL_TRACES" || featureName === "POSTMORTEM_GENERATOR" ? "ENTERPRISE" : "PROFESSIONAL",
          currentTier: tier,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  PLAN_LIMITS,
  checkServiceLimit,
  requirePlanFeature,
};
