const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { generatePostmortemMarkdown } = require("../src/services/postmortemAgent");

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning existing database records...");
  await prisma.alert.deleteMany({}).catch(() => {});
  await prisma.alertConfig.deleteMany({}).catch(() => {});
  await prisma.incident.deleteMany({}).catch(() => {});
  await prisma.traceSpan.deleteMany({}).catch(() => {});
  await prisma.metric.deleteMany({}).catch(() => {});
  await prisma.logEntry.deleteMany({}).catch(() => {});
  await prisma.user.deleteMany({}).catch(() => {});
  await prisma.service.deleteMany({}).catch(() => {});
  await prisma.organization.deleteMany({}).catch(() => {});

  console.log("Seeding primary organization...");
  const org = await prisma.organization.create({
    data: {
      name: "Acme Cloud Platforms",
      slug: "acme-cloud",
      planTier: "PROFESSIONAL",
      apiKey: "devsight_key_demo_acme_prod_99182",
    },
  });

  // Secondary organization for testing multi-tenancy isolation
  const secondOrg = await prisma.organization.create({
    data: {
      name: "FinTech Global Ltd",
      slug: "fintech-global",
      planTier: "STARTER",
      apiKey: "devsight_key_demo_fintech_77123",
    },
  });

  const passwordHash = await bcrypt.hash("password123", 10);

  console.log("Seeding multi-role users...");
  const admin = await prisma.user.create({
    data: {
      email: "admin@demo.com",
      passwordHash,
      name: "Alex Rivera (Admin)",
      role: "ADMIN",
      organizationId: org.id,
    },
  });

  const devops = await prisma.user.create({
    data: {
      email: "devops@demo.com",
      passwordHash,
      name: "Jordan Lee (DevOps)",
      role: "DEVOPS_ENGINEER",
      organizationId: org.id,
    },
  });

  const dev = await prisma.user.create({
    data: {
      email: "developer@demo.com",
      passwordHash,
      name: "Sam Chen (Developer)",
      role: "DEVELOPER",
      organizationId: org.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: "manager@demo.com",
      passwordHash,
      name: "Morgan Taylor (Manager)",
      role: "MANAGER",
      organizationId: org.id,
    },
  });

  // User in secondary organization
  await prisma.user.create({
    data: {
      email: "fintech-admin@demo.com",
      passwordHash,
      name: "Riley Vance (FinTech Admin)",
      role: "ADMIN",
      organizationId: secondOrg.id,
    },
  });

  console.log("Seeding alert configurations...");
  await prisma.alertConfig.createMany({
    data: [
      { organizationId: org.id, channel: "SLACK", target: "https://hooks.slack.com/services/T00/B00/demo", enabled: true },
      { organizationId: org.id, channel: "EMAIL", target: "devops-oncall@acme.com", enabled: true },
      { organizationId: org.id, channel: "TEAMS", target: "https://outlook.office.com/webhook/demo", enabled: true },
    ],
  });

  console.log("Seeding monitored services...");
  const payment = await prisma.service.create({
    data: {
      name: "Payment Gateway",
      organizationId: org.id,
      status: "DEGRADED",
      baselineMs: 200,
      baselineErrorRate: 0.01,
      baselineCpu: 35,
    },
  });

  const checkout = await prisma.service.create({
    data: {
      name: "Checkout Service",
      organizationId: org.id,
      status: "HEALTHY",
      baselineMs: 150,
      baselineErrorRate: 0.005,
      baselineCpu: 40,
    },
  });

  const authSvc = await prisma.service.create({
    data: {
      name: "Auth & Identity API",
      organizationId: org.id,
      status: "HEALTHY",
      baselineMs: 85,
      baselineErrorRate: 0.002,
      baselineCpu: 25,
    },
  });

  const inventory = await prisma.service.create({
    data: {
      name: "Inventory Worker",
      organizationId: org.id,
      status: "HEALTHY",
      baselineMs: 120,
      baselineErrorRate: 0.008,
      baselineCpu: 50,
    },
  });

  // Service in second org
  await prisma.service.create({
    data: {
      name: "FinTech Banking Core",
      organizationId: secondOrg.id,
      status: "HEALTHY",
      baselineMs: 90,
    },
  });

  console.log("Seeding time-series telemetry metrics...");
  const now = Date.now();
  const metricData = [];

  // Payment service: 30 baseline readings + 1 spike at the end
  for (let i = 0; i < 30; i++) {
    const jitter = Math.random() * 20 - 10;
    metricData.push({
      serviceId: payment.id,
      name: "latency_ms",
      value: Math.round((200 + jitter) * 10) / 10,
      timestamp: new Date(now - (32 - i) * 60000),
    });
  }
  metricData.push({
    serviceId: payment.id,
    name: "latency_ms",
    value: 1850.5,
    timestamp: new Date(now - 2 * 60000),
  });

  // Checkout service metrics
  for (let i = 0; i < 25; i++) {
    const jitter = Math.random() * 15 - 7.5;
    metricData.push({
      serviceId: checkout.id,
      name: "latency_ms",
      value: Math.round((150 + jitter) * 10) / 10,
      timestamp: new Date(now - (25 - i) * 60000),
    });
  }

  // Auth service metrics
  for (let i = 0; i < 25; i++) {
    const jitter = Math.random() * 10 - 5;
    metricData.push({
      serviceId: authSvc.id,
      name: "latency_ms",
      value: Math.round((85 + jitter) * 10) / 10,
      timestamp: new Date(now - (25 - i) * 60000),
    });
  }

  // Inventory worker metrics
  for (let i = 0; i < 25; i++) {
    const jitter = Math.random() * 15 - 7.5;
    metricData.push({
      serviceId: inventory.id,
      name: "latency_ms",
      value: Math.round((120 + jitter) * 10) / 10,
      timestamp: new Date(now - (25 - i) * 60000),
    });
  }

  await prisma.metric.createMany({ data: metricData });

  console.log("Seeding OpenTelemetry trace spans...");
  const traceData = [
    {
      serviceId: payment.id,
      traceId: "trace_pay_9921_abc",
      spanId: "span_root_001",
      name: "POST /v1/charges",
      durationMs: 1820.5,
      statusCode: "ERROR",
      error: "Connection pool exhausted (active=50, max=50)",
      timestamp: new Date(now - 2 * 60000),
    },
    {
      serviceId: payment.id,
      traceId: "trace_pay_9921_abc",
      spanId: "span_db_acquire_002",
      parentSpanId: "span_root_001",
      name: "pg.pool.acquire",
      durationMs: 1502.1,
      statusCode: "ERROR",
      error: "Timeout acquiring connection from pool after 1500ms",
      timestamp: new Date(now - 2 * 60000),
    },
    {
      serviceId: checkout.id,
      traceId: "trace_chk_4412_xyz",
      spanId: "span_chk_root",
      name: "POST /v2/checkout/submit",
      durationMs: 165.2,
      statusCode: "OK",
      timestamp: new Date(now - 15 * 60000),
    },
    {
      serviceId: authSvc.id,
      traceId: "trace_auth_1102_def",
      spanId: "span_auth_jwt",
      name: "POST /v1/auth/token/verify",
      durationMs: 82.0,
      statusCode: "OK",
      timestamp: new Date(now - 10 * 60000),
    },
  ];

  await prisma.traceSpan.createMany({ data: traceData });

  console.log("Seeding application logs...");
  const logEntries = [
    { serviceId: payment.id, level: "info", message: "Stripe API client initialized with TLS 1.3", timestamp: new Date(now - 30 * 60000) },
    { serviceId: payment.id, level: "info", message: "Payment intent #pi_991823 validated for $49.00", timestamp: new Date(now - 20 * 60000) },
    { serviceId: payment.id, level: "warn", message: "Database connection pool utilization high (84% active, 42/50 connections)", timestamp: new Date(now - 8 * 60000) },
    { serviceId: payment.id, level: "error", message: "Connection pool exhausted (active=50, max=50). Connection request timed out after 1500ms at pg-pool", timestamp: new Date(now - 3 * 60000) },
    { serviceId: payment.id, level: "error", message: "HTTP 504 Gateway Timeout while proxying request to /v1/charges", timestamp: new Date(now - 2 * 60000) },
    { serviceId: payment.id, level: "warn", message: "Circuit breaker TRIPPED for upstream billing-replica-02", timestamp: new Date(now - 1 * 60000) },

    { serviceId: checkout.id, level: "info", message: "Cart checkout initiated for session #usr_7721", timestamp: new Date(now - 15 * 60000) },
    { serviceId: checkout.id, level: "warn", message: "Upstream payment service response time slower than usual (1820ms)", timestamp: new Date(now - 2 * 60000) },

    { serviceId: authSvc.id, level: "info", message: "OAuth token issued for user #usr_9941", timestamp: new Date(now - 10 * 60000) },
    { serviceId: inventory.id, level: "info", message: "Inventory sync job completed (14,200 items updated)", timestamp: new Date(now - 25 * 60000) },
  ];

  await prisma.logEntry.createMany({ data: logEntries });

  console.log("Seeding sample incident, root cause analysis, and postmortem...");
  const whatFailed = "Payment Gateway Database Connection Pool Saturation";
  const whyReason = "Database connection pool reached maximum capacity (50/50 active connections), causing incoming query queues to time out and spike end-to-end latency to 1,850.5ms.";
  const impact = "Users experiencing checkout finalization timeouts; estimated 12% drop in transaction completions during the surge.";
  const suggestedFix = "Scale PostgreSQL connection pool ceiling (max: 150) in database client configuration and terminate unindexed slow queries holding table locks.";

  const rawContextSnapshot = {
    anomaly: {
      isAnomaly: true,
      severity: "HIGH",
      observedValue: 1850.5,
      baselineMean: 200.2,
      stddev: 6.1,
      deviationStdDevs: 270.5,
    },
    metricsSnapshot: metricData.slice(-5),
    logsSnapshot: logEntries.filter((l) => l.serviceId === payment.id).slice(-3),
    tracesSnapshot: traceData.filter((t) => t.serviceId === payment.id),
  };

  const postmortemMarkdown = generatePostmortemMarkdown({
    incident: {
      whatFailed,
      whyReason,
      impact,
      suggestedFix,
      severity: "HIGH",
      confidence: 0.96,
      timeToRootCauseSeconds: 1.42,
      status: "OPEN",
      createdAt: new Date(now - 2 * 60000),
    },
    service: payment,
    metrics: rawContextSnapshot.metricsSnapshot,
    logs: rawContextSnapshot.logsSnapshot,
    traces: rawContextSnapshot.tracesSnapshot,
    anomaly: rawContextSnapshot.anomaly,
  });

  const correlatedSignals = [
    "Telemetry spike: 1850.5ms (Baseline: 200.2ms, Deviation: +270.5σ)",
    'Error Log: "Connection pool exhausted (active=50, max=50). Connection request timed out after 1500ms"',
    'Trace Span Bottleneck: "POST /v1/charges" (1820.5ms, Status: ERROR)',
  ];

  const incident = await prisma.incident.create({
    data: {
      serviceId: payment.id,
      status: "OPEN",
      severity: "HIGH",
      whatFailed,
      whyReason,
      impact,
      suggestedFix,
      confidence: 0.96,
      timeToRootCauseSeconds: 1.42,
      correlatedSignals: JSON.stringify(correlatedSignals),
      postmortemDraft: postmortemMarkdown,
      rawContext: JSON.stringify(rawContextSnapshot),
      createdAt: new Date(now - 2 * 60000),
    },
  });

  await prisma.alert.createMany({
    data: [
      {
        incidentId: incident.id,
        channel: "SLACK",
        recipient: "https://hooks.slack.com/services/T00/B00/demo",
        sentAt: new Date(now - 2 * 60000),
        success: true,
      },
      {
        incidentId: incident.id,
        channel: "EMAIL",
        recipient: "devops-oncall@acme.com",
        sentAt: new Date(now - 2 * 60000),
        success: true,
      },
      {
        incidentId: incident.id,
        channel: "TEAMS",
        recipient: "https://outlook.office.com/webhook/demo",
        sentAt: new Date(now - 2 * 60000),
        success: true,
      },
    ],
  });

  console.log("\n=======================================================");
  console.log("✅ DevSight AI Database Successfully Seeded!");
  console.log("=======================================================");
  console.log("Primary Organization:  ", org.name, `(${org.planTier})`);
  console.log("API Key:               ", org.apiKey);
  console.log("Demo Logins (password: password123):");
  console.log("  👑 Admin:     admin@demo.com");
  console.log("  ⚙️  DevOps:    devops@demo.com");
  console.log("  💻 Developer: developer@demo.com");
  console.log("  📊 Manager:   manager@demo.com");
  console.log("-------------------------------------------------------");
  console.log("Secondary Org:         ", secondOrg.name, "(for isolation tests)");
  console.log("=======================================================\n");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
