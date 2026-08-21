const express = require("express");
const { z } = require("zod");
const prisma = require("../utils/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

let Anthropic = null;
try {
  Anthropic = require("@anthropic-ai/sdk");
} catch (e) {}

const ingestSchema = z.object({
  serviceId: z.string(),
  level: z.enum(["info", "warn", "error", "fatal", "debug"]).default("info"),
  message: z.string().min(1),
  attributes: z.record(z.any()).optional(),
});

// Ingest single log line
router.post("/ingest", async (req, res, next) => {
  try {
    const data = ingestSchema.parse(req.body);
    const service = await prisma.service.findFirst({
      where: { id: data.serviceId, organizationId: req.user.organizationId },
    });
    if (!service) return res.status(404).json({ error: "Service not found in organization" });

    const log = await prisma.logEntry.create({
      data: {
        serviceId: data.serviceId,
        level: data.level,
        message: data.message,
        attributes: data.attributes ? JSON.stringify(data.attributes) : null,
      },
    });

    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
});

// Query logs with multi-factor filtering
router.get("/", async (req, res, next) => {
  try {
    const { serviceId, level, search, limit } = req.query;
    const where = {
      service: { organizationId: req.user.organizationId },
    };

    if (serviceId) {
      where.serviceId = String(serviceId);
    }
    if (level && ["info", "warn", "error", "fatal", "debug"].includes(String(level).toLowerCase())) {
      where.level = String(level).toLowerCase();
    }
    if (search) {
      where.message = { contains: String(search) };
    }

    const logs = await prisma.logEntry.findMany({
      where,
      include: { service: { select: { id: true, name: true } } },
      orderBy: { timestamp: "desc" },
      take: Math.min(Number(limit) || 150, 400),
    });

    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// Query logs for a single service
router.get("/:serviceId", async (req, res, next) => {
  try {
    const logs = await prisma.logEntry.findMany({
      where: {
        serviceId: req.params.serviceId,
        service: { organizationId: req.user.organizationId },
      },
      orderBy: { timestamp: "desc" },
      take: 200,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

const explainSchema = z.object({ rawLog: z.string().min(1) });

// AI Log Explainer: Translates arbitrary stack traces & logs into plain English
router.post("/explain", async (req, res, next) => {
  try {
    const { rawLog } = explainSchema.parse(req.body);
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (apiKey && apiKey.startsWith("sk-ant-") && Anthropic) {
      try {
        const client = new Anthropic({ apiKey });
        const response = await client.messages.create({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 400,
          system:
            "You are an expert DevOps and SRE assistant inside DevSight AI. " +
            "Explain raw application/infra log output or stack traces in plain English for developers. " +
            "Be concise (2-4 sentences). State the likely root cause and give one concrete actionable fix.",
          messages: [{ role: "user", content: rawLog.slice(0, 8000) }],
        });

        const explanation = response.content
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("")
          .trim();

        if (explanation) {
          return res.json({ explanation });
        }
      } catch (err) {
        console.warn("[log.routes] Anthropic explain failed, falling back to heuristic:", err.message);
      }
    }

    // Heuristic intelligent log explanation fallback
    const explanation = generateHeuristicLogExplanation(rawLog);
    res.json({ explanation });
  } catch (err) {
    next(err);
  }
});

function generateHeuristicLogExplanation(raw) {
  const text = raw.toLowerCase();

  if (text.includes("connection pool") || text.includes("pool exhausted") || text.includes("econnrefused")) {
    return "The application failed because its database connection pool reached maximum capacity (all connections active) and incoming queries timed out waiting for an open connection. Recommended action: increase connection pool limits in database client settings and check for unindexed or slow queries holding locks.";
  }
  if (text.includes("504") || text.includes("gateway timeout") || text.includes("etimedout")) {
    return "A 504 Gateway Timeout occurred because an upstream proxy or internal microservice took longer than the configured timeout window to respond. Recommended action: verify downstream microservice health, increase HTTP client timeout thresholds, or add circuit-breaker retry policies.";
  }
  if (text.includes("out of memory") || text.includes("heap limit") || text.includes("javascript heap out of memory")) {
    return "The process was killed because it exceeded allocated RAM ceiling (OOM error), typically triggered by an in-memory buffer leak or unpaginated large database query. Recommended action: increase container memory limit (--max-old-space-size) and stream large responses instead of buffering in RAM.";
  }
  if (text.includes("rate limit") || text.includes("429") || text.includes("too many requests")) {
    return "The request was rejected due to an active rate limiter (HTTP 429). Recommended action: check client burst patterns, inspect rate limit configuration, and apply exponential backoff with jitter on retries.";
  }
  if (text.includes("jwks") || text.includes("unauthorized") || text.includes("jwt") || text.includes("401") || text.includes("invalid token")) {
    return "Authentication failed because the access token is invalid, expired, or failed signature verification against JWKS public keys. Recommended action: verify token expiration timestamps and ensure auth signing keys match across microservices.";
  }
  if (text.includes("syntaxerror") || text.includes("typeerror") || text.includes("cannot read property") || text.includes("undefined")) {
    return "A JavaScript runtime exception occurred due to dereferencing an undefined property or missing object. Recommended action: inspect the line number indicated in the stack trace and implement defensive optional chaining (?.) or null validation.";
  }
  if (text.includes("deadlock") || text.includes("lock wait timeout")) {
    return "A database deadlock occurred when concurrent transactions attempted to acquire mutually conflicting locks in opposing sequence. Recommended action: enforce consistent table access ordering across transactions and reduce transaction scope.";
  }

  return `Log analysis: The log entry indicates an operational event: "${raw.slice(0, 120).trim()}...". Review recent dependency response times and check service error logs around this timestamp.`;
}

module.exports = router;
