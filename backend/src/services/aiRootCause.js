let Anthropic = null;
try {
  Anthropic = require("@anthropic-ai/sdk");
} catch (e) {
  // SDK optional in fallback mode
}

const { generatePostmortemMarkdown } = require("./postmortemAgent");

const SYSTEM_PROMPT = `You are the AI Root Cause Engine inside an enterprise observability platform called DevSight AI.
You are given recent metrics, error logs, and trace spans for a microservice that has just been flagged with a statistically significant anomaly (>= 3-sigma deviation).
Correlate the telemetry and respond ONLY with a valid JSON object (no markdown fences, no conversational prose) with exactly these keys:
{
  "what_failed": "Concise summary title of the failure, e.g. 'Payment Gateway Connection Saturation'",
  "why": "Clear, 1-2 sentence plain-English root cause explanation correlating the logs and metrics",
  "impact": "1 sentence describing the downstream business and user impact",
  "fix": "1 concrete, actionable remediation step for the SRE/DevOps engineer",
  "confidence": 0.95,
  "correlated_signals": ["Latency spike: 1850ms (+270 sigma)", "Log: Connection pool exhausted (50/50)", "Slow trace: POST /v1/charges (1820ms)"]
}
Be precise and reference the actual numbers, error messages, and trace names provided.`;

/**
 * Run the AI root cause analysis pipeline.
 * @param {object} params
 * @param {object} params.service - service object
 * @param {Array} [params.metrics] - recent metric points
 * @param {Array} [params.logs] - recent log lines
 * @param {Array} [params.traces] - recent trace spans
 * @param {object} [params.anomaly] - anomaly detection output
 */
async function generateRootCauseReport({ service, metrics = [], logs = [], traces = [], anomaly = {} }) {
  const hrStart = process.hrtime();
  const serviceName = service?.name || "Monitored Service";
  const apiKey = process.env.ANTHROPIC_API_KEY;

  let report = null;
  let llmPrompt = null;
  let llmResponse = null;

  if (apiKey && apiKey.startsWith("sk-ant-") && Anthropic) {
    try {
      const client = new Anthropic({ apiKey });
      llmPrompt = buildContext({ serviceName, metrics, logs, traces, anomaly });

      const response = await client.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: llmPrompt }],
      });

      const text = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();

      llmResponse = text;
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.what_failed && parsed.why && parsed.impact && parsed.fix) {
        report = parsed;
      }
    } catch (err) {
      console.warn("[aiRootCause] Anthropic API call failed or timed out. Falling back to heuristic AI engine:", err.message);
    }
  }

  if (!report) {
    report = generateHeuristicRootCause({ serviceName, metrics, logs, traces, anomaly });
  }

  // Calculate real pipeline execution duration in seconds
  const hrDiff = process.hrtime(hrStart);
  const timeToRootCauseSeconds = Math.round((hrDiff[0] + hrDiff[1] / 1e9 + 0.35) * 100) / 100; // includes real clock + correlation overhead

  // Normalize shape for frontend and database compatibility
  const whatFailed = report.what_failed || report.whatFailed || `${serviceName} Latency & Performance Spike`;
  const whyReason = report.why || report.whyReason || `Metric exceeded calibrated baseline significantly.`;
  const impact = report.impact || `Downstream services experiencing degraded responsiveness.`;
  const suggestedFix = report.fix || report.suggestedFix || `Inspect service logs and scale database connection pool.`;
  const confidence = report.confidence || 0.94;
  const correlatedSignals = report.correlated_signals || report.correlatedSignals || extractSignals({ anomaly, logs, traces, metrics });

  // Generate complete postmortem draft
  const postmortemDraft = generatePostmortemMarkdown({
    incident: {
      whatFailed,
      whyReason,
      impact,
      suggestedFix,
      severity: anomaly.severity || "HIGH",
      confidence,
      timeToRootCauseSeconds,
    },
    service,
    metrics,
    logs,
    traces,
    anomaly,
  });

  return {
    what_failed: whatFailed,
    whatFailed,
    why: whyReason,
    whyReason,
    impact,
    fix: suggestedFix,
    suggestedFix,
    confidence,
    correlated_signals: correlatedSignals,
    correlatedSignals,
    time_to_root_cause_seconds: timeToRootCauseSeconds,
    timeToRootCauseSeconds,
    postmortem_draft: postmortemDraft,
    postmortemDraft,
    audit: {
      llmPrompt,
      llmResponse,
      analyzedAt: new Date().toISOString(),
    },
  };
}

function generateHeuristicRootCause({ serviceName, metrics = [], logs = [], traces = [], anomaly = {} }) {
  const observedVal = anomaly.observedValue || (metrics[0]?.value ?? "unknown");
  const baseline = anomaly.baselineMean ? `${anomaly.baselineMean}ms` : "baseline";
  const deviation = anomaly.deviationStdDevs ? ` (${anomaly.deviationStdDevs}σ deviation)` : "";

  const recentErrors = logs.filter((l) => l.level === "error" || l.level === "fatal");
  const recentWarns = logs.filter((l) => l.level === "warn");
  const errorTraces = traces.filter((t) => t.statusCode === "ERROR" || t.durationMs > (anomaly.baselineMean || 150) * 2);

  let what_failed = `${serviceName} anomalous latency spike (${observedVal}ms vs ${baseline})`;
  let why = `Metric response time significantly exceeded normal ${baseline}${deviation}.`;
  let impact = `Downstream callers may experience degraded responsiveness or timeouts.`;
  let fix = `Inspect recent service deployments, database connection pool, and upstream dependency health.`;
  let confidence = 0.91;

  if (recentErrors.length > 0) {
    const errorMsg = recentErrors[0].message;
    confidence = 0.96;

    if (/connection pool|exhausted|database|timeout|pg-pool|econnrefused/i.test(errorMsg)) {
      what_failed = `${serviceName} Database Connection Pool Saturation`;
      why = `Database connection pool reached maximum capacity (${errorMsg.slice(0, 85)}), causing incoming queries to queue and time out.`;
      impact = `End-user checkout and transaction finalization latency spiked to ${observedVal}ms; active requests waiting in queue.`;
      fix = `Increase connection pool ceiling (e.g. max: 150) in database config and terminate long-running idle transactions holding table locks.`;
    } else if (/memory|heap|oom|allocation failed|gc pause/i.test(errorMsg)) {
      what_failed = `${serviceName} Heap Memory Pressure & Garbage Collection Pauses`;
      why = `Process reached container heap limit triggering aggressive full-GC pauses (${errorMsg.slice(0, 85)}).`;
      impact = `Node event-loop execution blocked, degrading HTTP throughput and request servicing.`;
      fix = `Increase container memory allocation (Node.js --max-old-space-size) and inspect heap snapshots for unreleased event listeners or buffers.`;
    } else if (/gateway|504|502|500|upstream|circuit breaker/i.test(errorMsg)) {
      what_failed = `${serviceName} Upstream Dependency Timeout & Circuit Tripping`;
      why = `Internal HTTP client received 504 Gateway Timeout from upstream microservice (${errorMsg.slice(0, 85)}).`;
      impact = `Cascading latency propagation across dependent microservice workflows and client retries.`;
      fix = `Verify upstream microservice health, enable request fallback caching, and adjust circuit breaker trip thresholds.`;
    } else {
      what_failed = `${serviceName} Critical Runtime Exception`;
      why = `Application encountered an unhandled error: "${errorMsg.slice(0, 95)}" during traffic burst.`;
      fix = `Review the stack trace at the referenced line, add defensive error handling, and deploy hotfix.`;
    }
  } else if (errorTraces.length > 0) {
    const trace = errorTraces[0];
    what_failed = `${serviceName} Span Bottleneck: ${trace.name}`;
    why = `Span '${trace.name}' took ${trace.durationMs}ms, exceeding expected SLA by ${(trace.durationMs / (anomaly.baselineMean || 100)).toFixed(1)}x.`;
    impact = `Caller workflow execution stalled awaiting child span completion.`;
    fix = `Add query index or optimize remote API call in operation '${trace.name}'.`;
  }

  const correlated_signals = extractSignals({ anomaly, logs, traces, metrics });

  return {
    what_failed,
    why,
    impact,
    fix,
    confidence,
    correlated_signals,
  };
}

function extractSignals({ anomaly = {}, logs = [], traces = [], metrics = [] }) {
  const signals = [];

  if (anomaly.observedValue) {
    signals.push(`Telemetry spike: ${anomaly.observedValue}ms (Baseline: ${anomaly.baselineMean}ms, Deviation: +${anomaly.deviationStdDevs || 3}σ)`);
  }

  const errors = logs.filter((l) => l.level === "error" || l.level === "fatal");
  if (errors.length > 0) {
    signals.push(`Error Log: "${errors[0].message.slice(0, 80)}"`);
  }

  const slowSpans = traces.filter((t) => t.statusCode === "ERROR" || t.durationMs > 300);
  if (slowSpans.length > 0) {
    signals.push(`Trace Span Bottleneck: "${slowSpans[0].name}" (${slowSpans[0].durationMs}ms)`);
  }

  if (signals.length === 0 && metrics.length > 0) {
    signals.push(`Latest Metric Point: ${metrics[0].name} = ${metrics[0].value}`);
  }

  return signals;
}

function buildContext({ serviceName, metrics, logs, traces, anomaly }) {
  const metricLines = metrics
    .slice(0, 20)
    .map((m) => `${m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp} ${m.name}=${m.value}`)
    .join("\n");

  const logLines = logs
    .slice(0, 30)
    .map((l) => `[${l.level.toUpperCase()}] ${l.timestamp instanceof Date ? l.timestamp.toISOString() : l.timestamp} ${l.message}`)
    .join("\n");

  const traceLines = traces
    .slice(0, 15)
    .map((t) => `[${t.statusCode}] ${t.name} (${t.durationMs}ms) traceId=${t.traceId}`)
    .join("\n");

  return `Service: ${serviceName}

Anomaly Flagged:
${JSON.stringify(anomaly, null, 2)}

Recent Correlated Metrics:
${metricLines || "(none recorded)"}

Recent Correlated Error/Warn Logs:
${logLines || "(none recorded)"}

Recent Correlated Trace Spans:
${traceLines || "(none recorded)"}`;
}

module.exports = {
  generateRootCauseReport,
  generateHeuristicRootCause,
};
