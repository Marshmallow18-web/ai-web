const request = require("supertest");
const app = require("../src/server");
const prisma = require("../src/utils/prisma");

describe("Multi-Tenant Data Isolation Tests", () => {
  let tokenOrgA;
  let tokenOrgB;
  let serviceOrgA;
  let serviceOrgB;

  beforeAll(async () => {
    // Login as Admin from Org A (Acme Cloud Platforms)
    const resA = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@demo.com", password: "password123" });
    tokenOrgA = resA.body.token;

    // Login as Admin from Org B (FinTech Global Ltd)
    const resB = await request(app)
      .post("/api/auth/login")
      .send({ email: "fintech-admin@demo.com", password: "password123" });
    tokenOrgB = resB.body.token;

    // Fetch services for Org A and Org B
    const svcsA = await request(app)
      .get("/api/services")
      .set("Authorization", `Bearer ${tokenOrgA}`);
    serviceOrgA = svcsA.body[0];

    const svcsB = await request(app)
      .get("/api/services")
      .set("Authorization", `Bearer ${tokenOrgB}`);
    serviceOrgB = svcsB.body[0];
  });

  test("Org A user should only see Org A services", async () => {
    const res = await request(app)
      .get("/api/services")
      .set("Authorization", `Bearer ${tokenOrgA}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const names = res.body.map((s) => s.name);
    expect(names).toContain("Payment Gateway");
    expect(names).not.toContain("FinTech Banking Core");
  });

  test("Org B user should not be able to fetch Org A service details by ID", async () => {
    const res = await request(app)
      .get(`/api/services/${serviceOrgA.id}`)
      .set("Authorization", `Bearer ${tokenOrgB}`);

    expect(res.status).toBe(404);
  });

  test("Org B user should not be able to delete Org A service", async () => {
    const res = await request(app)
      .delete(`/api/services/${serviceOrgA.id}`)
      .set("Authorization", `Bearer ${tokenOrgB}`);

    expect(res.status).toBe(404);
  });

  test("Org B user cannot see Org A incidents", async () => {
    const resA = await request(app)
      .get("/api/incidents")
      .set("Authorization", `Bearer ${tokenOrgA}`);
    const incidentA = resA.body[0];

    if (incidentA) {
      const resB = await request(app)
        .get(`/api/incidents/${incidentA.id}`)
        .set("Authorization", `Bearer ${tokenOrgB}`);

      expect(resB.status).toBe(404);
    }
  });

  test("Dashboard summary is strictly isolated per organization", async () => {
    const dashA = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${tokenOrgA}`);

    const dashB = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${tokenOrgB}`);

    expect(dashA.status).toBe(200);
    expect(dashB.status).toBe(200);
    expect(dashA.body.organization.name).toBe("Acme Cloud Platforms");
    expect(dashB.body.organization.name).toBe("FinTech Global Ltd");
    expect(dashA.body.totalServices).toBeGreaterThan(1);
    expect(dashB.body.totalServices).toBe(1);
  });
});
