const { recordMetricAndCheck, DEVIATION_THRESHOLD_STDDEVS } = require("../src/services/anomalyDetection");
const prisma = require("../src/utils/prisma");

describe("Statistical Anomaly Detection & Baselining Tests", () => {
  let testService;

  beforeAll(async () => {
    const org = await prisma.organization.findFirst();
    testService = await prisma.service.create({
      data: {
        name: `Anomaly Test Service ${Date.now()}`,
        organizationId: org.id,
        status: "HEALTHY",
        baselineMs: 100,
      },
    });

    // Seed 20 baseline points around 100ms
    const points = [];
    for (let i = 0; i < 20; i++) {
      points.push({
        serviceId: testService.id,
        name: "latency_ms",
        value: 100 + (i % 2 === 0 ? 3 : -3),
        timestamp: new Date(Date.now() - (25 - i) * 1000),
      });
    }
    await prisma.metric.createMany({ data: points });
  });

  afterAll(async () => {
    if (testService) {
      await prisma.metric.deleteMany({ where: { serviceId: testService.id } });
      await prisma.service.delete({ where: { id: testService.id } }).catch(() => {});
    }
  });

  test("Normal metric point near baseline should not be flagged as anomaly", async () => {
    const result = await recordMetricAndCheck(testService.id, "latency_ms", 102);

    expect(result.isAnomaly).toBe(false);
    expect(result.deviationStdDevs).toBeLessThan(DEVIATION_THRESHOLD_STDDEVS);
    expect(result.severity).toBe("NONE");
  });

  test("Statistical spike >= 3-sigma should be flagged as anomaly", async () => {
    // With baseline ~100ms and stddev ~3ms, a reading of 800ms is > 200 sigma
    const result = await recordMetricAndCheck(testService.id, "latency_ms", 850);

    expect(result.isAnomaly).toBe(true);
    expect(result.deviationStdDevs).toBeGreaterThanOrEqual(DEVIATION_THRESHOLD_STDDEVS);
    expect(["HIGH", "CRITICAL"]).toContain(result.severity);
  });
});
