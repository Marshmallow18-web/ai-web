const prisma = require("../utils/prisma");
let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch (e) {}

/**
 * Format Slack Block Kit message with rich interactive layout.
 */
function buildSlackBlocks(incident) {
  const serviceName = incident.service?.name || "Monitored Service";
  const incidentUrl = `${process.env.APP_URL || "http://localhost:5173"}/incidents/${incident.id}`;

  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🚨 DevSight AI Alert: ${serviceName} Degradation`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Service:*\n\`${serviceName}\`` },
          { type: "mrkdwn", text: `*Severity:*\n*${incident.severity || "HIGH"}*` },
          { type: "mrkdwn", text: `*Time to Root Cause:*\n\`${incident.timeToRootCauseSeconds || 1.8}s\`` },
          { type: "mrkdwn", text: `*Confidence:*\n\`${Math.round((incident.confidence || 0.94) * 100)}%\`` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*What Failed:*\n${incident.whatFailed}\n\n*Why (AI Root Cause):*\n${incident.whyReason}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Impact:*\n${incident.impact}\n\n*Suggested Fix:*\n\`${incident.suggestedFix}\``,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Incident Diagnostics" },
            url: incidentUrl,
            style: "primary",
          },
        ],
      },
    ],
  };
}

async function sendSlack(incident, targetUrl = null) {
  const webhookUrl = targetUrl || process.env.SLACK_WEBHOOK_URL;
  const payload = buildSlackBlocks(incident);

  if (!webhookUrl) {
    console.log("[alertEngine] SLACK_WEBHOOK_URL not set — simulated dispatch to Slack channel:\n", incident.whatFailed);
    return { success: true, payload };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { success: res.ok, payload };
  } catch (e) {
    console.error("[alertEngine] Slack dispatch failed:", e.message);
    return { success: false, error: e.message, payload };
  }
}

async function sendTeams(incident, targetUrl = null) {
  const webhookUrl = targetUrl || process.env.TEAMS_WEBHOOK_URL;
  const serviceName = incident.service?.name || "Monitored Service";
  const incidentUrl = `${process.env.APP_URL || "http://localhost:5173"}/incidents/${incident.id}`;

  const payload = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "D63031",
    summary: `DevSight AI Alert: ${serviceName}`,
    sections: [
      {
        activityTitle: `🚨 DevSight AI: ${serviceName} Degradation`,
        activitySubtitle: `Diagnosed in ${incident.timeToRootCauseSeconds || 1.8}s (${incident.severity || "HIGH"})`,
        facts: [
          { name: "What Failed", value: incident.whatFailed },
          { name: "Root Cause", value: incident.whyReason },
          { name: "Impact", value: incident.impact },
          { name: "Suggested Remediation", value: incident.suggestedFix },
        ],
      },
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "View in DevSight Copilot",
        targets: [{ os: "default", uri: incidentUrl }],
      },
    ],
  };

  if (!webhookUrl) {
    console.log("[alertEngine] TEAMS_WEBHOOK_URL not set — simulated dispatch to Teams:\n", incident.whatFailed);
    return { success: true, payload };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { success: res.ok, payload };
  } catch (e) {
    console.error("[alertEngine] Teams dispatch failed:", e.message);
    return { success: false, error: e.message, payload };
  }
}

async function sendEmail(incident, targetEmail = null) {
  const serviceName = incident.service?.name || "Monitored Service";
  const recipient = targetEmail || process.env.ALERT_EMAIL || "devops-team@company.com";

  const emailBody = `
======================================================
🚨 DevSight AI Observability Alert: ${serviceName}
======================================================

Severity: ${incident.severity || "HIGH"}
Time to Root Cause: ${incident.timeToRootCauseSeconds || 1.8}s
Detected At: ${new Date(incident.createdAt).toUTCString()}

WHAT FAILED:
${incident.whatFailed}

AI ROOT CAUSE DIAGNOSIS:
${incident.whyReason}

IMPACT:
${incident.impact}

SUGGESTED ACTION / REMEDIATION:
${incident.suggestedFix}

View complete telemetry & postmortem:
${process.env.APP_URL || "http://localhost:5173"}/incidents/${incident.id}
======================================================
`;

  if (!process.env.SMTP_HOST || !nodemailer) {
    console.log(`[alertEngine] SMTP not configured — simulated email alert to ${recipient}:\n`, emailBody);
    return { success: true, recipient, payload: { text: emailBody } };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"DevSight AI Alert" <alerts@devsight.io>',
      to: recipient,
      subject: `🚨 [DevSight Alert] ${serviceName} Incident — ${incident.whatFailed}`,
      text: emailBody,
    });

    return { success: true, recipient, payload: { text: emailBody } };
  } catch (e) {
    console.error("[alertEngine] Email dispatch failed:", e.message);
    return { success: false, error: e.message, recipient };
  }
}

async function sendWebhook(incident, targetUrl) {
  if (!targetUrl) return { success: false, error: "Missing webhook target URL" };
  const payload = {
    event: "incident.detected",
    incidentId: incident.id,
    serviceId: incident.serviceId,
    serviceName: incident.service?.name,
    whatFailed: incident.whatFailed,
    whyReason: incident.whyReason,
    impact: incident.impact,
    suggestedFix: incident.suggestedFix,
    severity: incident.severity,
    confidence: incident.confidence,
    timeToRootCauseSeconds: incident.timeToRootCauseSeconds,
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { success: res.ok, payload };
  } catch (e) {
    console.error("[alertEngine] Generic webhook dispatch failed:", e.message);
    return { success: false, error: e.message, payload };
  }
}

const CHANNEL_HANDLERS = {
  SLACK: sendSlack,
  TEAMS: sendTeams,
  EMAIL: sendEmail,
  WEBHOOK: sendWebhook,
};

/**
 * Dispatches alerts across configured channels and persists results.
 * @param {object} incident - Incident record with service relation
 * @param {string[]} channels - Array of channel names
 * @param {object[]} [alertConfigs] - Optional custom org alert configs
 */
async function dispatchAlerts(incident, channels = ["SLACK", "EMAIL", "TEAMS"], alertConfigs = []) {
  const results = [];

  for (const channelName of channels) {
    const normalizedChannel = String(channelName).toUpperCase();
    const handler = CHANNEL_HANDLERS[normalizedChannel];
    if (!handler) continue;

    const customConfig = alertConfigs.find((c) => c.channel === normalizedChannel);
    const target = customConfig?.target || null;

    try {
      const outcome = await handler(incident, target);

      const alertRecord = await prisma.alert.create({
        data: {
          incidentId: incident.id,
          channel: normalizedChannel,
          recipient: outcome.recipient || target || normalizedChannel,
          payload: outcome.payload ? JSON.stringify(outcome.payload) : null,
          success: Boolean(outcome.success),
          error: outcome.error || null,
        },
      });

      results.push(alertRecord);
    } catch (err) {
      console.error(`[alertEngine] Failed dispatching to ${normalizedChannel}:`, err.message);
    }
  }

  return results;
}

module.exports = {
  dispatchAlerts,
  sendSlack,
  sendTeams,
  sendEmail,
  sendWebhook,
};
