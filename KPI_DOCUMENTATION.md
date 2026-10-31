# KPI Scorecard Dashboard Documentation

[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-black?style=flat)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-blue?style=flat)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-blue?style=flat)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.19-38bdf8?style=flat)](https://tailwindcss.com/)

> Technical documentation and system specification for the multi-plant manufacturing KPI scorecard platform.

---

## Table of Contents

- [Project Overview](#-project-overview)
- [Core Functionality](#-core-functionality)
  - [Scorecard Performance Matrix & Drilldowns](#scorecard-performance-matrix--drilldowns)
  - [Monthly Metric Capture](#monthly-metric-capture)
  - [Issue Tracking & Corrective Actions](#issue-tracking--corrective-actions)
  - [Administrative Management Suite](#administrative-management-suite)
  - [Automated PDF Reporting](#automated-pdf-reporting)
  - [Authentication & Access Control](#authentication--access-control)
- [Use Cases / Purpose](#-use-cases--purpose)
  - [Superadmin](#superadmin)
  - [Plant Administrator](#plant-administrator)
  - [Operational User / Area Manager](#operational-user--area-manager)
  - [Global Viewer / Corporate Management](#global-viewer--corporate-management)
- [Tech Stack](#-tech-stack)
- [Architecture Summary](#-architecture-summary)
- [Entry Points](#-entry-points)
  - [Application Runtime Commands](#application-runtime-commands)
  - [Codebase Entry Points](#codebase-entry-points)
  - [Administrative & Utility Scripts](#administrative--utility-scripts)

---

## 📋 Project Overview

The **KPI Scorecard** is a web-based performance tracking and compliance platform built to replace a legacy Microsoft Access database (`access_data.accdb`) across multiple manufacturing plants. It centralizes metric definitions, monthly target configurations, data capture, and automated scoring of key performance indicators organized by business process and functional area. By calculating compliance ratios dynamically against defined operational thresholds, the platform gives plant operations and executive management real-time visibility into manufacturing health and standardizes corrective action workflows for non-compliant metrics.

---

## ⚙️ Core Functionality

| Module / Feature | Key Capabilities |
|---|---|
| **Scorecard Matrix & Drilldowns** | Dynamic cross-tabulation of functional areas by business processes across Month, Year, and Range modes with historical trend charts. |
| **Monthly Metric Capture** | Operational data entry for authorized plant areas enforcing 12-month validity flags, metric targets, and mandatory corrective actions for underperforming metrics. |
| **Issue Management** | Centralized lifecycle tracking for operational non-compliances, requiring root-cause analysis, corrective actions, deadlines, and closure verification. |
| **User & Access Administration** | Granular authorization management assigning users to global, plant-admin, or operational plant-area roles. |
| **Metric & Target Governance** | Central metric catalog with directional scoring rules, 12-month active flags, threshold configuration, and month-over-month target propagation. |
| **Audit & Security Logging** | Automated database-level change capture on critical tables via triggers alongside login attempt auditing. |
| **Executive PDF Export** | Client-side vector PDF compilation delivering printable monthly plant performance digests. |

### Scorecard Performance Matrix & Drilldowns
- **Multi-Period Aggregation**: Supports three distinct temporal analysis modes: single month, full year (aggregating all 12 monthly periods), and custom date ranges.
- **Hierarchical Drilldowns**: Users can drill down from the high-level matrix into specific area-process intersections, process totals across all areas, area totals across all processes, or plant-wide totals.
- **Historical Trajectory & Trendlines**: Incorporates 24-month metric histories and compliance evolution charts powered by linear regression analysis to identify operational trends.

### Monthly Metric Capture
- **Target-Aware Validation**: Renders input forms only for metrics active in the catalog, assigned a target for the selected period, and marked valid for that specific calendar month.
- **Dual Attribution**: Allows assigning responsibility for captured figures either to registered system users or through free-text name entries.
- **Mandatory Exception Reporting**: When an entered value evaluates to a non-compliant score, the interface forces the user to provide an issue description, a corrective action plan, a committed resolution date, and a designated owner before persistence is allowed.

### Issue Tracking & Corrective Actions
- **Corrective Action Registry**: Dedicated workflow listing all metrics that missed targets during capture.
- **Resolution Control**: Restricts issue resolution rights to the author who captured the result, requiring resolution notes upon closing an issue.

### Administrative Management Suite
- **User Management**: Inline account creation, credential reset with one-time temporary password generation, account activation toggling, and assignment of plant/area permissions.
- **Metric Catalog & Validity Rules**: Creation and maintenance of metric items with unit specifications, directional polarity (`higher_is_better`), and a 12-month validity boolean matrix per plant and calendar year.
- **Target Configuration**: Establishment of yellow and green operational thresholds per plant, metric, and period, supported by a batch copying utility that propagates targets from previous months.
- **Compliance Threshold Settings**: Global configuration of plant scorecard yellow/green boundaries with date-effective versioning.
- **System Audit Logs**: Superadmin console inspecting database mutations (`INSERT`, `UPDATE`, `DELETE`) with before/after JSON payloads and full audit logs of user login attempts.

### Automated PDF Reporting
- **Vector PDF Generation**: Compiles executive scorecard summaries into multi-page PDF documents client-side using predefined structural templates.

### Authentication & Access Control
- **Credential Protection**: Uses `argon2id` cryptographic hashing with randomized salts for credential security.
- **Forced Password Reset**: Implements a `must_change_password` flag that intercepts unprivileged navigation and routes users directly to a self-service password update screen upon initial sign-in.

---

## 🎯 Use Cases / Purpose

The system is designed for multi-tiered manufacturing organizations operating international production facilities (e.g. Chihuahua, France, Czech Republic, China, Brazil, León, Morocco). System roles and workflows directly reflect organizational duties:

### Superadmin
- **System Governance**: Sets global scorecard compliance thresholds, maintains the global metric catalog, and manages all user accounts across plants.
- **Security & Compliance Auditing**: Reviews database trigger-generated mutation logs and authentication histories across all facilities.

### Plant Administrator
- **Local Facility Management**: Configures monthly targets and 12-month validity flags for metrics measured within their specific plant.
- **Operational Access Delegation**: Grants plant floor and department personnel permissions to capture metrics within designated functional areas.

### Operational User / Area Manager
- **Monthly Performance Capture**: Submits operational results for assigned functional areas (e.g., Quality Control, Maintenance, Tool Room, Logistics).
- **Corrective Action Execution**: Formulates remediation plans when operational targets are missed and marks issues as resolved once countermeasures take effect.

### Global Viewer / Corporate Management
- **Cross-Plant Performance Monitoring**: Corporate executives and general managers review aggregated performance indicators across plants without modifying production numbers or configuration.
- **Reporting**: Exports consolidated PDF digests for executive reviews and board presentations.

---

## 💻 Tech Stack

All dependencies and technologies used in the project, verified against project configuration files:

| Category | Technology | Version / Specification | Source Configuration File |
|---|---|---|---|
| **Frontend Framework** | Next.js (App Router) | `16.2.6` | `package.json` |
| **UI Library** | React / React DOM | `19.2.4` | `package.json` |
| **Language** | TypeScript | `^5` | `package.json`, `tsconfig.json` |
| **Styling** | Tailwind CSS | `^3.4.19` | `package.json`, `tailwind.config.js` |
| **CSS Processing** | PostCSS, Autoprefixer | `^8.5.15`, `^10.5.0` | `package.json`, `postcss.config.mjs` |
| **Data Visualization** | Recharts | `^3.8.1` | `package.json` |
| **Document Generation** | @react-pdf/renderer | `^4.5.1` | `package.json` |
| **Authentication** | NextAuth.js | `^4.24.14` | `package.json` |
| **Security & Hashing** | Argon2 (`argon2id`) | `^0.44.0` | `package.json` |
| **Database Driver** | pg (node-postgres) | `^8.21.0` | `package.json` |
| **Database Engine** | PostgreSQL | `18` | `queries.sql`, `TECHNICAL_README.md` |
| **Code Quality** | ESLint / eslint-config-next | `^9`, `16.2.6` | `package.json`, `eslint.config.mjs` |
| **Database Scripting** | Python (psycopg2, argon2-cffi) | `3.x` | `seed_admin.py` |
| **Automation & Shell** | PowerShell | `Windows PowerShell` | `dump_scorecard.ps1` |

> [!NOTE]
> The database layer does not use an Object-Relational Mapper (ORM). All database transactions and queries execute through parameterized raw SQL against a `pg.Pool` connection pool.

---

## 🏗️ Architecture Summary

The system is a fullstack web application running on **Node.js** using the **Next.js App Router**:

1. **Client Tier**: Modern React 19 Client Components render the user interface, incorporating Recharts for trend visualization and Tailwind CSS for utility styling. Document export takes place directly in the browser using `@react-pdf/renderer`.
2. **API & Route Handler Tier**: Next.js App Router REST endpoints (`/api/*`) process incoming client requests. Endpoints enforce role and plant-level authorization based on the user's decoded session token.
3. **Session & Security Layer**: NextAuth v4 manages sessions via JSON Web Tokens (JWT) stored in HTTP-only cookies. A custom proxy module (`proxy.ts`) acts as a request middleware, enforcing authentication redirects and intercepting accounts flagged with required password resets.
4. **Data Persistence & Business Logic**: Data is stored in **PostgreSQL**. Instead of evaluating compliance formulas in application memory, business scoring rules (scoring metrics 0, 1, or 2 points) and multi-level scorecard aggregations (cells, process totals, area totals, and annual rollups) are executed directly within relational database views (`v_metric_score`, `v_scorecard_cell`, `v_scorecard_cell_yearly`, etc.).
5. **Auditing Infrastructure**: Critical tables are monitored by a PostgreSQL PL/pgSQL trigger function (`trg_audit`). Write operations set a session-level configuration variable (`app.user_id`) inside transaction blocks, allowing the database to log user IDs alongside JSON snapshots of data mutations in an append-only audit table.

---

## 🚀 Entry Points

### Application Runtime Commands

Defined in `package.json`:

```bash
# Start local development server on port 4554
npm run dev

# Compile TypeScript and build production bundle
npm run build

# Start production server on port 4554 (requires build)
npm run start

# Build and start in a single step
npm run serve

# Run ESLint validation
npm run lint

# Run TypeScript typecheck without emitting output
npm run typecheck
```

### Codebase Entry Points

| File Path | Component / Role | Description |
|---|---|---|
| `app/layout.tsx` | Root Layout | Root application shell that injects global styles and wraps children with the NextAuth `SessionProvider`. |
| `app/page.tsx` | Dashboard Entry Page | Main client-side landing page hosting the interactive scorecard matrix, period selectors, and PDF export trigger. |
| `proxy.ts` | Request Proxy / Middleware | Intercepts HTTP requests to enforce authentication checks and mandatory password updates. |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth Handler | Handles authentication lifecycle actions (login verification, JWT generation, session retrieval). |
| `lib/db.ts` | Database Pool Singleton | Initializes and exports the shared PostgreSQL connection pool (`pg.Pool`) and query helper. |
| `lib/auth.ts` | Authentication Options | Configures NextAuth Credentials provider, argon2 password verification, and session token callbacks. |

### Administrative & Utility Scripts

```bash
# Bootstrap an initial superadmin user in the database
python seed_admin.py --dsn "host=127.0.0.1 port=5432 dbname=scorecard user=scorecard_app password=<password>" --email admin@example.com --name "Administrator"

# Export a full database dump with schema and data
powershell -ExecutionPolicy Bypass -File .\dump_scorecard.ps1
```
