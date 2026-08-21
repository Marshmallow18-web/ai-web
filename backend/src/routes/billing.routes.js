const express = require("express");
const { z } = require("zod");
const prisma = require("../utils/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { PLAN_LIMITS } = require("../middleware/billing");

let stripe = null;
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith("sk_")) {
  try {
    const Stripe = require("stripe");
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch (e) {}
}

const router = express.Router();

// Get subscription and usage status
router.get("/subscription", requireAuth, async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: { select: { services: true } },
      },
    });

    if (!org) return res.status(404).json({ error: "Organization not found" });

    const tier = (org.planTier || "STARTER").toUpperCase();
    const planInfo = PLAN_LIMITS[tier] || PLAN_LIMITS.STARTER;

    res.json({
      organizationId: org.id,
      organizationName: org.name,
      planTier: tier,
      planName: planInfo.name,
      priceInr: planInfo.priceInr,
      priceUsd: planInfo.priceUsd,
      maxServices: planInfo.maxServices,
      servicesCount: org._count.services,
      features: planInfo.features,
      availableTiers: PLAN_LIMITS,
    });
  } catch (err) {
    next(err);
  }
});

const checkoutSchema = z.object({
  tier: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
});

// Create Stripe checkout session
router.post("/checkout", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { tier, successUrl, cancelUrl } = checkoutSchema.parse(req.body);
    const orgId = req.user.organizationId;
    const plan = PLAN_LIMITS[tier];

    if (stripe) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "inr",
              product_data: {
                name: `DevSight AI ${plan.name} Tier`,
                description: `Autonomous Observability copilot for up to ${plan.maxServices === 10000 ? "unlimited" : plan.maxServices} services`,
              },
              unit_amount: plan.priceInr * 100,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: successUrl || `${process.env.APP_URL || "http://localhost:5173"}/billing?status=success`,
        cancel_url: cancelUrl || `${process.env.APP_URL || "http://localhost:5173"}/billing?status=cancelled`,
        metadata: { organizationId: orgId, targetTier: tier },
      });

      return res.json({ checkoutUrl: session.url, sessionId: session.id });
    }

    // In dev / test mode without active Stripe key: directly update tier with simulated checkout
    await prisma.organization.update({
      where: { id: orgId },
      data: { planTier: tier },
    });

    res.json({
      message: `Simulated checkout completed for plan '${tier}'`,
      planTier: tier,
      success: true,
    });
  } catch (err) {
    next(err);
  }
});

// Instant dev/test simulator to test plan upgrades & downgrades
router.post("/simulate-tier", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { tier } = z.object({ tier: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]) }).parse(req.body);

    const updated = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data: { planTier: tier },
      include: { _count: { select: { services: true } } },
    });

    res.json({
      message: `Organization plan tier successfully switched to ${tier}`,
      planTier: updated.planTier,
      servicesCount: updated._count.services,
      limits: PLAN_LIMITS[tier],
    });
  } catch (err) {
    next(err);
  }
});

// Stripe Webhook handler
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event = req.body;

  if (stripe && sig && process.env.STRIPE_WEBHOOK_SECRET) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("[billing/webhook] Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orgId = session.metadata?.organizationId;
      const targetTier = session.metadata?.targetTier;

      if (orgId && targetTier) {
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            planTier: targetTier,
            stripeCustomerId: session.customer || null,
            stripeSubscriptionId: session.subscription || null,
          },
        });
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      await prisma.organization.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { planTier: "STARTER" },
      });
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[billing/webhook] Processing error:", err);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

module.exports = router;
