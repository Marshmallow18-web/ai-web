const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");

const JWT_SECRET = process.env.JWT_SECRET || "devsight_jwt_super_secret_key_2026";

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers["x-api-key"] || req.headers["x-devsight-api-key"];

  // 1. Check API Key header (used by Prometheus/OTel/Loki ingestion agents)
  if (apiKeyHeader) {
    try {
      const org = await prisma.organization.findUnique({
        where: { apiKey: apiKeyHeader },
      });
      if (org) {
        req.user = {
          id: `agent_${org.id}`,
          email: `agent@${org.slug || "devsight.io"}`,
          role: "DEVOPS_ENGINEER",
          organizationId: org.id,
          organizationName: org.name,
          planTier: org.planTier,
          isApiKey: true,
        };
        req.organization = org;
        return next();
      }
    } catch (err) {
      console.error("[requireAuth] API Key lookup error:", err);
    }
  }

  // 2. Check Bearer token (JWT or API Key)
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  // Check if Bearer token is an API key format
  if (token.startsWith("devsight_key_") || token.length >= 24) {
    try {
      const org = await prisma.organization.findUnique({
        where: { apiKey: token },
      });
      if (org) {
        req.user = {
          id: `agent_${org.id}`,
          email: `agent@${org.slug || "devsight.io"}`,
          role: "DEVOPS_ENGINEER",
          organizationId: org.id,
          organizationName: org.name,
          planTier: org.planTier,
          isApiKey: true,
        };
        req.organization = org;
        return next();
      }
    } catch (err) {
      // Continue to JWT verification
    }
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, role, organizationId, organizationName, planTier }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Server-side RBAC guard
// Usage: requireRole("ADMIN", "DEVOPS_ENGINEER")
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Role hierarchy & permissions
    const userRole = String(req.user.role || "").toUpperCase();
    const normalizedAllowed = allowedRoles.map((r) => String(r).toUpperCase());

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        error: `Insufficient permissions: '${userRole}' role cannot perform this action. Required: [${allowedRoles.join(", ")}]`,
      });
    }

    next();
  };
}

// Multi-tenant organization boundary check
function requireTenant(req, res, next) {
  if (!req.user || !req.user.organizationId) {
    return res.status(403).json({ error: "No organization context associated with request" });
  }
  next();
}

module.exports = {
  requireAuth,
  requireRole,
  requireTenant,
  JWT_SECRET,
};
