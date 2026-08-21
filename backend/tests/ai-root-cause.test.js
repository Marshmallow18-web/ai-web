const request = require("supertest");
const app = require("../src/server");
const { generateRootCauseReport } = require("../src/services/aiRootCause");

describe("AI Root Cause & Postmortem Engine Tests", () => {
  let token;
  let incident;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@demo.com", password: "password123" });
    token = res.body.token;

    const incs = await request(app)
      .get("/api/incidents")
      .set("Authorization", `Bearer ${token}`);
    incident = incs.body[0];
  });

  test("generateRootCauseReport should output standard schema with measured latency", async () => {
    const report = await generateRootCauseReport({
      service: { name: "Payment Gateway", id: "svc_123" },
      metrics: [{ name: "latency_ms", value: 1850, timestamp: new Date() }],
      logs: [{ level: "error", message: "Connection pool exhausted (50/50)", timestamp: new Date() }],
      traces: [{ name: "POST /v1/charges", durationMs: 1820, statusCode: "ERROR" }],
      anomaly: { observedValue: 1850, baselineMean: 200, deviationStdDevs: 270 },
    });

    expect(report).toHaveProperty("what_failed");
    expect(report).toHaveProperty("why");
    expect(report).toHaveProperty("impact");
    expect(report).toHaveProperty("fix");
    expect(report).toHaveProperty("confidence");
    expect(report).toHaveProperty("time_to_root_cause_seconds");
    expect(report.time_to_root_cause_seconds).toBeGreaterThan(0);
    expect(report).toHaveProperty("postmortem_draft");
    expect(report.postmortem_draft).toContain("# Incident Postmortem:");
  });

  test("GET /api/incidents/:id/postmortem should export complete Markdown document", async () => {
    if (!incident) return;

    const res = await request(app)
      .get(`/api/incidents/${incident.id}/postmortem`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("postmortemMarkdown");
    expect(res.body.postmortemMarkdown).toContain("## 1. Executive Summary");
    expect(res.body.postmortemMarkdown).toContain("## 2. Telemetry & Anomaly Diagnostics");
  });

  test("POST /api/logs/explain should explain arbitrary error log in plain English", async () => {
    const rawLog = "ERROR [pg-pool] Connection pool exhausted (active=50, max=50). Connection request timed out after 5000ms";

    const res = await request(app)
      .post("/api/logs/explain")
      .set("Authorization", `Bearer ${token}`)
      .send({ rawLog });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("explanation");
    expect(res.body.explanation.toLowerCase()).toContain("connection pool");
  });
});
