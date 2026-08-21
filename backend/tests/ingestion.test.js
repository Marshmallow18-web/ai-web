const request = require("supertest");
const app = require("../src/server");
const prisma = require("../src/utils/prisma");

describe("Data Ingestion Pipeline Tests", () => {
  let token;
  let service;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@demo.com", password: "password123" });
    token = res.body.token;

    const svcs = await request(app)
      .get("/api/services")
      .set("Authorization", `Bearer ${token}`);
    service = svcs.body.find((s) => s.name === "Checkout Service") || svcs.body[0];
  });

  test("GET /metrics should expose Prometheus self-monitoring metrics", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("devsight_uptime_seconds");
    expect(res.text).toContain("devsight_monitored_services_total");
  });

  test("POST /api/ingest/prometheus should ingest timeseries batch", async () => {
    const payload = {
      timeseries: [
        {
          labels: { __name__: "latency_ms", service: service.name },
          samples: [{ value: 152.4, timestamp: Date.now() }],
        },
      ],
    };

    const res = await request(app)
      .post("/api/ingest/prometheus")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("success");
    expect(res.body.ingestedCount).toBeGreaterThanOrEqual(1);
  });

  test("POST /api/ingest/otlp/v1/traces should ingest OTLP trace spans", async () => {
    const payload = {
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: "service.name", value: { stringValue: service.name } }],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: `trace_test_${Date.now()}`,
                  spanId: `span_test_${Date.now()}`,
                  name: "HTTP GET /v1/health",
                  startTimeUnixNano: "1724220000000000000",
                  endTimeUnixNano: "1724220000050000000",
                  status: { code: "STATUS_CODE_OK" },
                },
              ],
            },
          ],
        },
      ],
    };

    const res = await request(app)
      .post("/api/ingest/otlp/v1/traces")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.ingestedSpansCount).toBe(1);
  });

  test("POST /api/ingest/loki should ingest Loki log stream", async () => {
    const payload = {
      streams: [
        {
          stream: { app: service.name, level: "info" },
          values: [[`${Date.now() * 1000000}`, "Test log line ingested via Loki pipeline"]],
        },
      ],
    };

    const res = await request(app)
      .post("/api/ingest/loki")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(204);
  });
});
