# DevSight AI — Autonomous Cloud & Microservice Observability Copilot

[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript%20%2B%20Vite-blue)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20TimescaleDB%20%2B%20Prisma-indigo)](https://www.prisma.io/)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-Claude%203.7%20Sonnet%20%2B%20Heuristic%20Core-purple)](https://www.anthropic.com/)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20%2B%20Kubernetes-orange)](https://kubernetes.io/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-brightgreen)](#)
[![License](https://img.shields.io/badge/License-MIT-orange)](#)

> **DevSight AI** is a production-ready, AI-native observability copilot. Engineers plug in their existing **Prometheus**, **OpenTelemetry**, and **Loki** stacks, and instead of reading dashboards, they get a plain-English root cause report — *what failed, why, what it's impacting, and how to fix it* — in under **2 minutes per incident**.

---

## 🚀 Key Features

| Feature | Status | Details |
|---|---|---|
| **Multi-Tenant Auth & RBAC** | ✅ Production | Strict tenant isolation with JWT, Google & GitHub OAuth, and role guards (`ADMIN`, `DEVOPS_ENGINEER`, `DEVELOPER`, `MANAGER`). |
| **Real Data Ingestion Pipeline** | ✅ Production | Prometheus remote-write (`/api/ingest/prometheus`), OpenTelemetry OTLP trace & metric receiver (`/v1/traces`, `/api/ingest/otlp/v1/traces`), and Loki stream push (`/loki/api/v1/push`). |
| **Statistical Anomaly Detection** | ✅ Production | Dynamic rolling baselines over time-series samples; automatically flags statistical deviations ($\ge 3\sigma$) and debounces duplicates. |
| **AI Root Cause Engine** | ✅ Production | Powered by Claude 3.7 Sonnet with intelligent heuristic fallback; correlates metrics, logs, and trace spans with measured `time_to_root_cause_seconds`. |
| **Autonomous Incident Agent** | ✅ Production | End-to-end autonomous pipeline: Ingest $\rightarrow$ Anomaly $\rightarrow$ AI Diagnosis $\rightarrow$ Persistent Incident $\rightarrow$ Multi-Channel Alert. |
| **Autonomous Postmortem Agent** | ✅ Production | Generates executive-ready Markdown postmortem documents with 1-click clipboard export (`GET /api/incidents/:id/postmortem`). |
| **Live Log Stream & Explainer** | ✅ Production | Live log stream with level filters, full-text search, and 1-click inline AI explanations for stack traces and system dumps. |
| **Multi-Channel Alert Dispatcher** | ✅ Production | Dispatches rich **Slack Block Kit** cards, **Microsoft Teams** adaptive cards, **Email (SMTP)** notifications, and **Webhooks** (PagerDuty/Opsgenie). |
| **Stripe Billing & Tier Gating** | ✅ Production | Tiered subscriptions: Starter (₹999/mo, 5 services), Professional (₹4,999/mo, 50 services), and Enterprise (₹19,999+/mo, unlimited) with server-side limit enforcement and dev simulation mode. |
| **Integrations & Ingestion Hub** | ✅ Production | Organization API key management and copyable YAML configurations for Prometheus, OpenTelemetry Collector, and Promtail. |
| **Docker & Kubernetes Ready** | ✅ Production | Multi-stage Dockerfiles, `docker-compose.yml` (Postgres, Backend, Frontend, Prometheus, Grafana), and Kubernetes manifests in `k8s/`. |

---

## 🏗️ System Architecture

```
                      ┌────────────────────────────────────────────────────────┐
                      │              Frontend (React + TypeScript)             │
                      │  Dashboard | Incidents | Logs | Postmortem | Billing   │
                      └───────────────────────────┬────────────────────────────┘
                                                  │ HTTP / REST / OAuth
                      ┌───────────────────────────▼────────────────────────────┐
                      │           API Gateway / Express Application            │
                      │       Multi-Tenant Scoping & RBAC Role Guards          │
                      └───┬─────────────┬─────────────┬─────────────┬──────────┘
                          │             │             │             │
        ┌─────────────────▼───┐  ┌──────▼──────┐  ┌───▼──────┐  ┌───▼──────────────────┐
        │ Ingestion Pipeline  │  │  AI Engine  │  │  Alerts  │  │ Stripe & Org Billing │
        │  • Prometheus OTLP  │  │  • Claude   │  │  • Slack │  │  • Starter (5 svcs)  │
        │  • OTel Traces/Logs │  │  • Heuristics│ │  • Email │  │  • Pro (50 svcs)     │
        │  • Loki Push API    │  │  • Postmortem│ │  • Teams │  │  • Enterprise (∞)    │
        └─────────┬───────────┘  └──────┬──────┘  └───┬──────┘  └──────────────────────┘
                  │                     │             │
        ┌─────────▼─────────────────────▼─────────────▼────────────────────────┐
        │                      Prisma ORM & PostgreSQL Database                │
        │    Orgs · Users · Services · Metrics · Logs · Traces · Incidents     │
        └──────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### 1. Prerequisites
* **Node.js:** v18 or higher
* **PostgreSQL:** Running on `localhost:5432` (or SQLite fallback mode for zero-friction dev)

### 2. Backend Setup
```bash
cd backend
npm install
npm run db:push:sqlite   # or `npm run db:push` for PostgreSQL
npm run seed             # seeds demo org, 4 services, metrics, traces, logs, and sample incidents
npm run dev              # running on http://localhost:4000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev              # running on http://localhost:5173
```

---

## 🔑 Demo Login Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@demo.com` | `password123` | Full access (Billing, Services, Users, API Keys) |
| **DevOps Engineer** | `devops@demo.com` | `password123` | Service management, Ingestion, Incident resolution |
| **Developer** | `developer@demo.com` | `password123` | Telemetry view, Log explainer, Anomaly testing |
| **Manager** | `manager@demo.com` | `password123` | Dashboards, Incident reports, Postmortem reviews |

*(You can also use **Google** / **GitHub** OAuth buttons on the login screen or register a new workspace).*

---

## 🧪 Testing the Autonomous AI Incident Pipeline

1. Sign in to `http://localhost:5173`.
2. On the **Unified Dashboard**, locate **Payment Gateway**.
3. Click **"⚡ Simulate Anomaly"**.
4. **Autonomous Pipeline Execution:**
   * A simulated latency spike ($\ge 1,800\text{ms}$) is ingested.
   * Statistical anomaly detector flags $\ge 3\sigma$ deviation above baseline.
   * AI Root Cause Engine correlates error logs, metric deviations, and OpenTelemetry trace spans.
   * A structured incident report is generated with plain-English *Why*, *Impact*, and *Suggested Fix*.
   * Service transitions to **`DEGRADED`** and multi-channel alerts are dispatched.
5. Click on the incident to review the diagnosis, correlated signals, and click **"📄 Postmortem Doc"** to copy the Markdown draft!

---

## 🧪 Running Automated Tests

```bash
cd backend
npm test
```
* **`tests/tenant-isolation.test.js`**: Verifies Org A cannot read or access Org B's resources.
* **`tests/anomaly-detection.test.js`**: Tests $3\sigma$ deviation calculations and rolling baselines.
* **`tests/ingestion.test.js`**: Tests Prometheus remote-write, OTel trace spans, and Loki log streams.
* **`tests/ai-root-cause.test.js`**: Tests AI schema compliance, `time_to_root_cause_seconds`, and postmortem generation.
* **`tests/rbac-billing.test.js`**: Tests role-based permissions and subscription tier limits.

---

## 🐳 Docker & Kubernetes Deployment

### Docker Compose
```bash
docker-compose up --build
```
Orchestrates PostgreSQL, DevSight Backend, DevSight Frontend (Nginx), Prometheus, and Grafana.

### Kubernetes Manifests
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## 📜 License
MIT License. Built for autonomous cloud observability and AI incident operations.
