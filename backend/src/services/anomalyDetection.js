const prisma = require("../utils/prisma");

const DEVIATION_THRESHOLD_STDDEVS = 3.0; // 3-sigma rule (99.73% confidence)
const CRITICAL_DEVIATION_STDDEVS = 5.0; // 5-sigma extreme outlier
const MIN_SAMPLES_FOR_BASELINE = 10;

/**
 * Record a metric data point and calculate dynamic statistical deviation.
 * @param {string} serviceId
 * @param {string} name - e.g. "latency_ms", "cpu_percent", "error_rate"
 * @param {number} value - observed numerical value
 * @param {object} [labels] - optional Prometheus/OTel labels
 * @returns {Promise<{
 *   isAnomaly: boolean,
 *   severity: "CRITICAL" | "HIGH" | "MEDIUM" | "NONE",
 *   baselineMean: number,
 *   stddev: number,
 *   observedValue: number,
 *   deviationStdDevs: number,
 *   sampleCount: number,
 *   shouldTriggerIncident: boolean
 * }>}
 */
async function recordMetricAndCheck(serviceId, name = "latency_ms", value, labels = null) {
  const metric = await prisma.metric.create({
    data: {
      serviceId,
      name,
      value: Number(value),
      labels: labels ? (typeof labels === "string" ? labels : JSON.stringify(labels)) : null,
    },
  });

  // Query recent window of up to 200 metric readings for rolling baseline
  const recent = await prisma.metric.findMany({
    where: { serviceId, name },
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  const configuredBaseline = service?.baselineMs || 150;

  if (recent.length < MIN_SAMPLES_FOR_BASELINE) {
    // Insufficient historical points: compare directly against calibrated baseline
    const fallbackStdDev = configuredBaseline * 0.15; // 15% estimated variance
    const deviation = Math.abs(value - configuredBaseline) / (fallbackStdDev || 1);
    const isAnomaly = deviation >= DEVIATION_THRESHOLD_STDDEVS;

    return {
      isAnomaly,
      severity: deviation >= CRITICAL_DEVIATION_STDDEVS ? "CRITICAL" : isAnomaly ? "HIGH" : "NONE",
      baselineMean: configuredBaseline,
      stddev: Math.round(fallbackStdDev * 100) / 100,
      observedValue: value,
      deviationStdDevs: Math.round(deviation * 100) / 100,
      sampleCount: recent.length,
      shouldTriggerIncident: isAnomaly,
    };
  }

  // Calculate dynamic rolling mean and sample standard deviation
  // Exclude the most recent spike value from the baseline mean if it's an extreme outlier
  const baselineSamples = recent.slice(1);
  const values = baselineSamples.map((m) => m.value);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / values.length;

  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length > 1 ? values.length - 1 : 1);
  const stddev = Math.sqrt(variance) || 1.0;

  const deviation = Math.abs(value - mean) / stddev;
  const isAnomaly = deviation >= DEVIATION_THRESHOLD_STDDEVS;

  let severity = "NONE";
  if (deviation >= CRITICAL_DEVIATION_STDDEVS) {
    severity = "CRITICAL";
  } else if (isAnomaly) {
    severity = "HIGH";
  }

  // Update calibrated baseline in background if healthy
  if (!isAnomaly && name === "latency_ms" && service) {
    const updatedMean = Math.round(mean * 10) / 10;
    if (Math.abs(updatedMean - (service.baselineMs || 0)) > 5) {
      prisma.service
        .update({
          where: { id: serviceId },
          data: { baselineMs: updatedMean },
        })
        .catch(() => {});
    }
  }

  // Check debounce / cooldown: Is there already an OPEN or INVESTIGATING incident in last 5 minutes?
  let shouldTriggerIncident = isAnomaly;
  if (isAnomaly) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingRecentIncident = await prisma.incident.findFirst({
      where: {
        serviceId,
        status: { in: ["OPEN", "INVESTIGATING"] },
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (existingRecentIncident) {
      shouldTriggerIncident = false; // Debounce duplicate incident creation
    }
  }

  return {
    isAnomaly,
    severity,
    baselineMean: Math.round(mean * 100) / 100,
    stddev: Math.round(stddev * 100) / 100,
    observedValue: value,
    deviationStdDevs: Math.round(deviation * 100) / 100,
    sampleCount: recent.length,
    shouldTriggerIncident,
  };
}

module.exports = {
  recordMetricAndCheck,
  DEVIATION_THRESHOLD_STDDEVS,
  CRITICAL_DEVIATION_STDDEVS,
};
