const request = require("supertest");
const app = require("../src/server");
const prisma = require("../src/utils/prisma");

describe("RBAC Permissions and Billing Tier Gating Tests", () => {
  let adminToken;
  let devToken;

  beforeAll(async () => {
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@demo.com", password: "password123" });
    adminToken = adminRes.body.token;

    const devRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "developer@demo.com", password: "password123" });
    devToken = devRes.body.token;
  });

  test("Developer role cannot delete a service (requires ADMIN or DEVOPS_ENGINEER)", async () => {
    const svcs = await request(app)
      .get("/api/services")
      .set("Authorization", `Bearer ${adminToken}`);
    const svc = svcs.body[0];

    const res = await request(app)
      .delete(`/api/services/${svc.id}`)
      .set("Authorization", `Bearer ${devToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Insufficient permissions");
  });

  test("GET /api/billing/subscription should return current tier and service limits", async () => {
    const res = await request(app)
      .get("/api/billing/subscription")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("planTier");
    expect(res.body).toHaveProperty("maxServices");
    expect(res.body).toHaveProperty("servicesCount");
    expect(res.body).toHaveProperty("availableTiers");
  });

  test("POST /api/billing/simulate-tier should switch tiers for organization", async () => {
    const res = await request(app)
      .post("/api/billing/simulate-tier")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tier: "ENTERPRISE" });

    expect(res.status).toBe(200);
    expect(res.body.planTier).toBe("ENTERPRISE");

    // Restore to PROFESSIONAL
    await request(app)
      .post("/api/billing/simulate-tier")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tier: "PROFESSIONAL" });
  });
});
