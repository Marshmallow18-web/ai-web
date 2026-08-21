const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../utils/prisma");
const { requireAuth, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationName: z.string().min(1),
  role: z.enum(["ADMIN", "DEVOPS_ENGINEER", "DEVELOPER", "MANAGER"]).optional().default("ADMIN"),
});

// Register a new Organization and initial Admin user
router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: "Email is already registered" });

    const slug = data.organizationName.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Math.floor(Math.random() * 1000);
    const org = await prisma.organization.create({
      data: {
        name: data.organizationName,
        slug,
        planTier: "PROFESSIONAL", // Start with 14-day Professional trial
      },
    });

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role || "ADMIN",
        provider: "LOCAL",
        organizationId: org.id,
      },
    });

    // Create default alert configs for the organization
    await prisma.alertConfig.createMany({
      data: [
        { organizationId: org.id, channel: "EMAIL", target: data.email, enabled: true },
        { organizationId: org.id, channel: "SLACK", target: "https://hooks.slack.com/services/demo", enabled: false },
        { organizationId: org.id, channel: "TEAMS", target: "https://outlook.office.com/webhook/demo", enabled: false },
      ],
    });

    const token = signToken(user, org);
    res.status(201).json({
      token,
      user: sanitizeUser(user),
      organization: { id: org.id, name: org.name, planTier: org.planTier, apiKey: org.apiKey },
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Login with email and password
router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { organization: true },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user, user.organization);
    res.json({
      token,
      user: sanitizeUser(user),
      organization: user.organization
        ? { id: user.organization.id, name: user.organization.name, planTier: user.organization.planTier, apiKey: user.organization.apiKey }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// OAUTH (Google / GitHub) Authentication Handlers
// -------------------------------------------------------------
const oauthSchema = z.object({
  provider: z.enum(["google", "github"]),
  token: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  organizationName: z.string().optional(),
});

router.post("/oauth", async (req, res, next) => {
  try {
    const { provider, email: providedEmail, name: providedName, organizationName } = oauthSchema.parse(req.body);
    const providerUpper = provider.toUpperCase();

    // Default simulated OAuth profile if client doesn't provide specific test user
    const email = providedEmail || (provider === "google" ? "google-engineer@demo.com" : "github-devops@demo.com");
    const name = providedName || (provider === "google" ? "Google SRE User" : "GitHub DevOps User");

    let user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user) {
      // First time OAuth login: Create new Org and User
      const orgName = organizationName || `${name.split(" ")[0]}'s Workspace`;
      const org = await prisma.organization.create({
        data: {
          name: orgName,
          planTier: "PROFESSIONAL",
        },
      });

      user = await prisma.user.create({
        data: {
          email,
          name,
          role: "ADMIN",
          provider: providerUpper,
          organizationId: org.id,
        },
        include: { organization: true },
      });
    }

    const token = signToken(user, user.organization);
    res.json({
      token,
      user: sanitizeUser(user),
      organization: user.organization
        ? { id: user.organization.id, name: user.organization.name, planTier: user.organization.planTier, apiKey: user.organization.apiKey }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// Current user profile & organization context
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { organization: true },
    });

    if (!user) {
      // API Key agent fallback
      if (req.user.isApiKey) {
        return res.json({ user: req.user, organization: req.organization });
      }
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: sanitizeUser(user),
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            planTier: user.organization.planTier,
            apiKey: user.organization.apiKey,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// Regenerate Organization API Key
router.post("/api-key/regenerate", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== "ADMIN" && req.user.role !== "DEVOPS_ENGINEER") {
      return res.status(403).json({ error: "Only Admin or DevOps Engineers can regenerate API keys" });
    }

    const newApiKey = `devsight_key_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`;
    const updated = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data: { apiKey: newApiKey },
    });

    res.json({ apiKey: updated.apiKey });
  } catch (err) {
    next(err);
  }
});

function signToken(user, org = {}) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: org.name || "Default Org",
      planTier: org.planTier || "STARTER",
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function sanitizeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

module.exports = router;
