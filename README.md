# TECHNICAL_README.md

## 1. Project overview

Multi-plant manufacturing KPI scorecard with monthly value capture, replacing a legacy MS Access database. Built with **Next.js 16 App Router** + **TypeScript** + **Tailwind CSS 3**, **PostgreSQL** accessed via the raw `pg` driver (no ORM), and **NextAuth v4** using the Credentials provider with argon2id password hashing.

---

## 2. Prerequisites

- **Node.js 20+** (no `.nvmrc` present; inferred from `@types/node ^20` in devDependencies)
- **PostgreSQL** running locally (tested on PostgreSQL 18)
- A `.env.local` file at the project root containing:

```
PGHOST=
PGPORT=
PGDATABASE=
PGUSER=
PGPASSWORD=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

---

## 3. Folder structure

```
app/                       Next.js App Router pages and API routes
  api/                     Backend REST endpoints
    account/
      change-password/     POST — self-service password change
    admin/
      logs/                GET — audit trail and login events
      metric-validity/     GET, POST — per-month metric availability
      metrics/             GET, POST — metric catalog
        [metricId]/        PUT — update a single metric
      targets/             GET, POST — metric targets per period
        copy-from-previous/ POST — copy targets from the previous month
      users/               GET, POST, PUT — user management
    auth/
      [...nextauth]/       NextAuth handler (Credentials + JWT)
    capture/               GET, POST — value capture
    metric-history/        GET — historical values for a single metric
    scorecard/             GET — scorecard data for a plant/period
      selectors/           GET — available plants and periods
  admin/
    logs/                  page.tsx — audit log viewer (superadmin only)
    metrics/               page.tsx — metric catalog admin
    targets/               page.tsx — target definition per period
    users/                 page.tsx — user management
  account/
    change-password/       page.tsx — self-service password form
  capture/                 page.tsx — monthly value capture
  login/                   page.tsx — authentication
  scorecard/
    [plant]/[year]/[month]/[area]/[process]/
                           page.tsx — cell-level detail drilldown
    total/[dimension]/[code]/[plant]/[year]/[month]/
                           page.tsx — process or area total drilldown
  globals.css              Global CSS (Tailwind directives + CSS variables)
  layout.tsx               Root layout (SessionProvider, font)
  page.tsx                 Main scorecard dashboard

components/                Shared React components
  AdminLogsClient.tsx      Client UI for /admin/logs (filter bar, table, pagination)
  AdminMetricsClient.tsx   Client UI for /admin/metrics (inline CRUD + validity drawer)
  AdminTargetsClient.tsx   Client UI for /admin/targets (period navigator, auto-save)
  AdminUsersClient.tsx     Client UI for /admin/users (inline CRUD, password modal)
  AppHeader.tsx            Global navigation header (nav links, sign-out)
  CaptureClient.tsx        Client UI for /capture (plant/area selectors, result entry)
  DetailChartPanel.tsx     Chart panel for cell-level drilldown pages
  EvolutionChart.tsx       Line chart component (recharts)
  MetricEvolutionChart.tsx Line chart for individual metric history
  OverallBadge.tsx         Circular badge showing overall compliance %
  PeriodSelector.tsx       Plant/year/month dropdown group
  ProcessEvolutionChart.tsx Line chart for process-level history
  ProcessHistoryModal.tsx  Modal showing historical compliance for a process
  ScorecardCell.tsx        Single scorecard grid cell
  ScorecardGrid.tsx        Full scorecard matrix (areas × processes)
  SessionProvider.tsx      Thin wrapper around NextAuth SessionProvider
  UserMenu.tsx             Dropdown user menu in the header

lib/                       Server-side shared utilities
  auth.ts                  NextAuth options, Credentials provider, login event logging
  db.ts                    PostgreSQL Pool singleton (pg driver); exports query() and pool
  mockProcessHistory.ts    Static mock data used during development/testing
  regression.ts            Linear regression helper for trend charts
  scorecard.ts             TypeScript types and color-computation logic for scorecard data

public/                    Static assets
  safe-demo_logo-blc-Photoroom.png  Application logo
  file.svg, globe.svg, next.svg, vercel.svg, window.svg  Default Next.js assets
```

---

## 4. Database

### Tables

| Table | Purpose |
|---|---|
| `plant` | Manufacturing plants. Each plant is an independent reporting unit. |
| `area` | Functional areas within a plant (e.g., QC, Logistics, Maintenance). |
| `process` | Business processes (Plan / Customer / Support categories). |
| `metric` | Metric catalog. IDs preserved from the legacy Access database. |
| `app_user` | Application users with role flags, argon2id password hash, and audit metadata. |
| `user_plant_area_access` | Per-(user, plant, area) access grants for operational users. |
| `scorecard_threshold` | Global yellow/green compliance thresholds with effective-from dates. |
| `period` | Year + month periods. Auto-generates a `period_date` (first of month). |
| `metric_target` | Yellow and green limits per (plant, metric, period). |
| `metric_result` | Captured monthly values per (plant, metric, period). One row per combination; updated in place. |
| `audit_log` | Append-only audit trail. Populated by the `trg_audit` trigger function. |
| `metric_validity` | Per-(metric, plant, year) boolean flags for each of the 12 months; governs which metrics are capturable. |
| `login_event` | Records each login attempt (success or failure) with IP address and user agent. |

### Views

| View | Purpose |
|---|---|
| `v_metric_score` | Scores each metric result 0 (red), 1 (yellow), or 2 (green) against its target and direction flag. |
| `v_scorecard_cell` | Compliance ratio and color per (plant, period, area, process). Replaces the legacy T_Graph table. |
| `v_scorecard_process_total` | Compliance aggregated by process across all areas in a plant/period. |
| `v_scorecard_area_total` | Compliance aggregated by area across all processes in a plant/period. |
| `v_scorecard_overall` | Overall compliance ratio for a plant/period (the top-level percentage). |
| `v_metric_history` | Historical result values per metric across periods for trend rendering. |
| `v_cell_compliance_history` | Historical compliance ratio per (area, process) cell across periods. |
| `v_process_compliance_history` | Historical compliance ratio per process across periods. |
| `v_area_compliance_history` | Historical compliance ratio per area across periods. |

### Audit triggers

The `trg_audit` function is attached (AFTER INSERT OR UPDATE OR DELETE) to:
`metric`, `metric_result`, `metric_target`, `app_user`, `user_plant_area_access`, `metric_validity`.

---

## 5. API endpoints

### /api/auth
```
POST  /api/auth/[...nextauth]   NextAuth Credentials sign-in, sign-out, and session handlers.
                                No direct authorization required beyond the provider logic.
```

### /api/scorecard
```
GET   /api/scorecard            Return scorecard cells, process totals, area totals, and overall
                                for a given plant code + year + month.
                                Any authenticated user authorized for that plant.

GET   /api/scorecard/selectors  Return the list of available plants and periods.
                                Any authenticated user.
```

### /api/metric-history
```
GET   /api/metric-history       Return 24-month result history for a single metric in a plant.
                                Any authenticated user authorized for that plant.
```

### /api/capture
```
GET   /api/capture              Return capturable metrics (active, with a target, and validity=TRUE
                                for the requested month) for a given (plant, area, year, month).
                                Any authenticated user with access to that (plant, area).

POST  /api/capture              Upsert metric_result rows for a (plant, area, year, month) batch.
                                Validates validity flags and red-row required fields server-side.
                                Any authenticated user with access to that (plant, area).
```

### /api/account
```
POST  /api/account/change-password  Change the caller's own password. Verifies current password.
                                    Any authenticated user.
```

### /api/admin/users
```
GET   /api/admin/users          List users. Plant admin sees their plant; superadmin sees all.
                                Admin only (is_admin=TRUE).

POST  /api/admin/users          Create a user. Returns a one-time temporary password.
                                Admin only.

PUT   /api/admin/users          Update user fields, toggle active, or reset password.
                                Admin only.
```

### /api/admin/metrics
```
GET   /api/admin/metrics        List metrics. Plant admin sees their plant; superadmin sees all.
                                Admin only.

POST  /api/admin/metrics        Create a metric. metricId must be provided by the caller (1000–99999).
                                Admin only.

PUT   /api/admin/metrics/[metricId]  Update a metric's fields or active status.
                                     Admin only; plant admin restricted to their plant.
```

### /api/admin/targets
```
GET   /api/admin/targets        Return metric targets for a (plant, year, month).
                                Plant admin only (superadmin receives 403).

POST  /api/admin/targets        Upsert yellow/green limits for a list of metrics in a period.
                                Plant admin only.

POST  /api/admin/targets/copy-from-previous  Copy all targets from the previous month into the
                                             requested period. Skips metrics that already have a
                                             target. Plant admin only.
```

### /api/admin/metric-validity
```
GET   /api/admin/metric-validity   Return the 12 monthly boolean flags for a (metricId, year).
                                   Returns all-FALSE default if no row exists.
                                   Plant admin only.

POST  /api/admin/metric-validity   Upsert all 12 monthly flags for a (metricId, year).
                                   Year must be between 2020 and 2027 inclusive.
                                   Plant admin only.
```

### /api/admin/logs
```
GET   /api/admin/logs           Return paginated audit_log or login_event records with filters
                                (user, table, action, date range, success flag).
                                Superadmin only (plant admin receives 403).
```

---

## 6. Authentication and authorization model

NextAuth v4 uses the **Credentials provider** with **JWT sessions** (30-day maxAge, 24-hour updateAge). The session token is an httpOnly cookie. On each request, the server calls `getServerSession(authOptions)` to read the decoded JWT.

Three roles are defined by columns on `app_user`:

| Role | `is_admin` | `admin_plant_id` |
|---|---|---|
| Superadmin | `TRUE` | `NULL` |
| Plant admin | `TRUE` | `<plant_id>` |
| Operational | `FALSE` | — |

Navigation link visibility (from `AppHeader.tsx`) and route-level authorization:

| Route | Superadmin | Plant admin | Operational |
|---|---|---|---|
| `/` (dashboard) | ✓ | ✓ | ✓ |
| `/capture` | ✓ | ✓ | ✓ |
| `/admin/users` | ✓ | ✓ | ✗ |
| `/admin/metrics` | ✓ | ✓ | ✗ |
| `/admin/targets` | ✗ (link hidden; 403 at API) | ✓ | ✗ |
| `/admin/logs` | ✓ | ✗ (link hidden; 403 at API) | ✗ |
| `/account/change-password` | ✓ | ✓ | ✓ |

---

## 7. How to run locally

```bash
npm install

# Create .env.local with the variables listed in section 2.

# Apply migrations — the SQL files at the project root must be run manually
# against the target PostgreSQL database (see section 9).

npm run dev
```

The dev server starts at **http://localhost:3000** (default Next.js port).

---

## 8. How to build for production

```bash
npm run build
npm run start
```

The `.env.local` file (or equivalent environment variable injection) must be present in the production environment. `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are required at build time and at runtime.

---

## 9. Migrations

All SQL files are located at the project root. There is no dedicated `migrations/` folder.

| File | Description |
|---|---|
| `queries.sql` | Full schema: all tables, indexes, the `trg_audit` trigger function, and the initial scorecard views. Run once to create the database from scratch. |
| `plant_entries.sql` | Initial plant seed data (CHI, FRA, CZE, CHN, BRA, LEO, MAR). |
| `migrate_must_change_password.sql` | Adds the `must_change_password` boolean column to `app_user` and sets it TRUE for all existing rows. |
| `add_owner_text.sql` | Adds the `owner_text VARCHAR(200)` column to `metric_result` for free-text responsible-party names. |

---

## 10. Audit logging

Every write to critical tables is captured in `audit_log` via the trigger function `trg_audit`. The trigger reads `current_setting('app.user_id', TRUE)` to record `changed_by`; if the setting is not present, `changed_by` is stored as `NULL`.

Endpoints that write to audited tables set this within a `pool.connect()` + `BEGIN` + `COMMIT` block:

```sql
SELECT set_config('app.user_id', $1, true)
```

Endpoints that perform writes without this setup will leave `changed_by` NULL in the audit log.

---

## 11. Known commands

| Command | Description |
|---|---|
| `npm run dev` | Start local development server (hot reload) |
| `npm run build` | Compile and bundle for production |
| `npm run start` | Start the production server (requires prior build) |
| `npx tsc --noEmit` | Type-check the codebase without emitting files |

---

## 12. What this README does not cover

The following topics are documented separately and are out of scope for this file:

- Business rules (color computation logic, validity flag semantics, owner dual-mode behavior in capture).
- Migration history and the rationale behind each schema change.
- Bugs encountered during development and their fixes.
- Data model decisions and their justification.
