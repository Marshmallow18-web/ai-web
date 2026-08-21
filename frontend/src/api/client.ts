import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("devsight_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Shared types (mirror backend Prisma models) ---

export type Role = "ADMIN" | "DEVOPS_ENGINEER" | "DEVELOPER" | "MANAGER";
export type ServiceStatus = "HEALTHY" | "DEGRADED" | "DOWN" | "UNKNOWN";
export type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED";
export type AlertChannel = "EMAIL" | "SLACK" | "TEAMS" | "WEBHOOK";
export type PlanTier = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export interface Organization {
  id: string;
  name: string;
  planTier: PlanTier;
  apiKey: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  provider?: string;
}

export interface Metric {
  id: string;
  serviceId: string;
  name: string;
  value: number;
  labels?: string | Record<string, any> | null;
  timestamp: string;
}

export interface LogEntry {
  id: string;
  serviceId: string;
  level: "info" | "warn" | "error" | "fatal" | "debug";
  message: string;
  attributes?: string | Record<string, any> | null;
  timestamp: string;
  service?: {
    id: string;
    name: string;
  };
}

export interface TraceSpan {
  id: string;
  serviceId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  name: string;
  durationMs: number;
  statusCode: string;
  error?: string | null;
  timestamp: string;
}

export interface Alert {
  id: string;
  incidentId: string;
  channel: AlertChannel;
  recipient?: string | null;
  sentAt: string;
  success: boolean;
}

export interface AlertConfig {
  id: string;
  channel: AlertChannel;
  target: string;
  enabled: boolean;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  status: ServiceStatus;
  baselineMs: number | null;
  baselineErrorRate?: number | null;
  baselineCpu?: number | null;
  createdAt: string;
  _count?: {
    incidents: number;
    metrics: number;
    logs: number;
    traces?: number;
  };
  recentMetrics?: Metric[];
  recentTraces?: TraceSpan[];
}

export interface Incident {
  id: string;
  serviceId: string;
  service: Service;
  status: IncidentStatus;
  severity?: string;
  whatFailed: string;
  whyReason: string;
  impact: string;
  suggestedFix: string;
  confidence?: number;
  timeToRootCauseSeconds?: number;
  correlatedSignals?: string[] | string;
  correlated_signals?: string[];
  postmortemDraft?: string | null;
  postmortem_draft?: string | null;
  rawContext?: {
    anomaly?: {
      isAnomaly: boolean;
      severity?: string;
      observedValue: number;
      baselineMean: number;
      stddev: number;
      deviationStdDevs: number;
    };
    metrics?: Metric[];
    logs?: LogEntry[];
    metricsSnapshot?: Metric[];
    logsSnapshot?: LogEntry[];
    tracesSnapshot?: TraceSpan[];
  } | null;
  alerts?: Alert[];
  createdAt: string;
  resolvedAt: string | null;
}

export interface DashboardSummary {
  organization?: Organization;
  totalServices: number;
  statusCounts: Record<string, number>;
  openIncidentCount: number;
  services: Service[];
  recentIncidents: Incident[];
  recentAlerts?: Alert[];
}

export interface SubscriptionInfo {
  organizationId: string;
  organizationName: string;
  planTier: PlanTier;
  planName: string;
  priceInr: number;
  priceUsd: number;
  maxServices: number;
  servicesCount: number;
  features: string[];
  availableTiers: Record<
    string,
    {
      name: string;
      priceInr: number;
      priceUsd: number;
      maxServices: number;
      features: string[];
    }
  >;
}
