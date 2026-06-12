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
app/                          Next.js App Router pages and API routes
  api/                        Backend REST endpoints
    account/
      change-password/        POST — self-service password change
    admin/
      logs/                   GET — paginated audit_log and login_event records
      metric-validity/        GET, POST — per-month metric availability flags
      metrics/                GET, POST — metric catalog management
        [metricId]/           PUT — update a single metric
      targets/                GET, POST — metric targets per period
        copy-from-previous/   POST — copy targets from the previous month
      thresholds/             GET, POST — manage compliance color thresholds
      users/                  GET, POST, PUT — user management
    auth/
      [...nextauth]/          NextAuth handler (Credentials + JWT)
    capture/                  GET, POST — monthly value capture
    issues/                   GET — list corrective-action issues
      [resultId]/
        resolve/              PUT — mark an issue as resolved
    memory/                   GET — Node.js process memory stats (diagnostic)
    metric-history/           GET — historical values for a single metric
    scorecard/                GET — main scorecard data for a plant/period
      range-cell/             GET — cell-level metric detail for a date range
      range-total/            GET — process/area total detail for a date range
      selectors/              GET — available plants and periods
      yearly-cell/            GET — cell-level metric detail for a full year
      yearly-total/           GET — process/area total detail for a full year
    thresholds/               GET — current compliance thresholds (public read)
  admin/
    logs/                     page.tsx — audit log viewer
    metrics/                  page.tsx — metric catalog admin
    targets/                  page.tsx — target definition per period
    thresholds/               page.tsx — compliance threshold admin
    users/                    page.tsx — user management
  account/
    change-password/          page.tsx — self-service password form
  capture/                    page.tsx — monthly value capture
  issues/                     page.tsx — corrective actions list
  login/                      page.tsx — authentication
  scorecard/
    [plant]/[year]/[month]/[area]/[process]/
                              page.tsx — cell-level monthly detail drilldown
    [plant]/[year]/year/[area]/[process]/
                              page.tsx — cell-level yearly detail drilldown
    range/
      cell/                   page.tsx — cell-level range detail drilldown
      total/                  page.tsx — process/area total range detail
    total/[dimension]/[code]/[plant]/[year]/[month]/
                              page.tsx — process or area monthly total drilldown
    total/[dimension]/[code]/[plant]/[year]/year/
                              page.tsx — process or area yearly total drilldown
  globals.css                 Global CSS (Tailwind directives + CSS variables)
  layout.tsx                  Root layout (SessionProvider, font)
  page.tsx                    Main scorecard dashboard

components/                   Shared React components
  AdminLogsClient.tsx         Client UI for /admin/logs (filter bar, table, pagination)
  AdminMetricsClient.tsx      Client UI for /admin/metrics (inline CRUD + validity drawer)
  AdminTargetsClient.tsx      Client UI for /admin/targets (period navigator, auto-save)
  AdminThresholdsClient.tsx   Client UI for /admin/thresholds (threshold form)
  AdminUsersClient.tsx        Client UI for /admin/users (inline CRUD, password modal)
  AppHeader.tsx               Global navigation header (nav links, sign-out)
  CaptureClient.tsx           Client UI for /capture (plant/area selectors, result entry)
  DetailChartPanel.tsx        Chart panel for cell-level drilldown pages
  EvolutionChart.tsx          Line chart component (recharts)
  IssuesClient.tsx            Client UI for /issues (table, resolve modal, filters)
  MetricEvolutionChart.tsx    Line chart for individual metric history
  OverallBadge.tsx            Circular badge showing overall compliance %
  PeriodSelector.tsx          Plant/year/month dropdown group
  ProcessEvolutionChart.tsx   Line chart for process-level compliance history
  ProcessHistoryModal.tsx     Modal showing historical compliance for a process
  RangeDetailPanel.tsx        Detail panel for range-mode cell drilldown
  ScorecardCell.tsx           Single scorecard grid cell
  ScorecardGrid.tsx           Full scorecard matrix (areas × processes)
  SessionProvider.tsx         Thin wrapper around NextAuth SessionProvider
  UserMenu.tsx                Dropdown user menu in the header
  YearlyDetailPanel.tsx       Detail panel for year-mode cell drilldown

lib/                          Server-side shared utilities
  auth.ts                     NextAuth options, Credentials provider, login event logging
  db.ts                       PostgreSQL Pool singleton (pg driver); exports query() and pool
  mockProcessHistory.ts       Static mock data used during development/testing
  regression.ts               Linear regression helper for trend charts
  scorecard.ts                TypeScript types and color-computation logic for scorecard data

public/                       Static assets
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
| `metric` | Metric catalog. IDs are preserved from the legacy Access database. |
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
| `v_scorecard_overall` | Overall compliance ratio for a plant/period. |
| `v_metric_history` | Historical result values per metric across periods for trend rendering. |
| `v_cell_compliance_history` | Historical compliance ratio per (area, process) cell across periods. |
| `v_process_compliance_history` | Historical compliance ratio per process across periods. |
| `v_area_compliance_history` | Historical compliance ratio per area across periods. |
| `v_scorecard_cell_yearly` | Compliance ratio per (plant, year, area, process) aggregated across all months of a year. |
| `v_scorecard_process_total_yearly` | Yearly compliance aggregated by process. |
| `v_scorecard_area_total_yearly` | Yearly compliance aggregated by area. |
| `v_scorecard_overall_yearly` | Overall yearly compliance ratio for a plant/year. |
| `v_metric_yearly` | Per-metric yearly aggregated values (average across months). |

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

### /api/thresholds
```
GET   /api/thresholds           Return the current compliance thresholds (yellow_min, green_min).
                                Any authenticated user.
```

### /api/scorecard
```
GET   /api/scorecard            Return scorecard cells, process totals, area totals, and overall
                                for a given plant code + period (month, year, or range).
                                Any authenticated user authorized for that plant.

GET   /api/scorecard/selectors  Return the list of available plants and periods.
                                Any authenticated user.

GET   /api/scorecard/yearly-cell     Return cell-level metric detail aggregated across a full year.
                                     Any authenticated user authorized for that plant.

GET   /api/scorecard/yearly-total    Return process or area total metric detail for a full year.
                                     Any authenticated user authorized for that plant.

GET   /api/scorecard/range-cell      Return cell-level metric detail aggregated over a date range.
                                     Any authenticated user authorized for that plant.

GET   /api/scorecard/range-total     Return process or area total metric detail for a date range.
                                     Any authenticated user authorized for that plant.
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

### /api/issues
```
GET   /api/issues               Return paginated list of corrective-action issues (red metric
                                results with comment, corrective action, and owner).
                                Any authenticated non-global-viewer user.

PUT   /api/issues/[resultId]/resolve  Mark a single issue as resolved with a resolution note.
                                      Only the user who captured the issue (created_by or updated_by).
                                      Superadmin and global viewer are rejected.
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

### /api/admin/thresholds
```
GET   /api/admin/thresholds     Return the current compliance thresholds.
                                Admin only.

POST  /api/admin/thresholds     Insert or update today's threshold row (yellowMin, greenMin, notes).
                                Admin only.
```

### /api/admin/logs
```
GET   /api/admin/logs           Return paginated audit_log or login_event records with filters
                                (user, table, action, date range, success flag).
                                Superadmin only (plant admin receives 403).
```

### /api/memory
```
GET   /api/memory               Return Node.js process memory usage stats (RSS, heap, etc.).
                                No authentication required.
```

---

## 6. Authentication and authorization model

NextAuth v4 uses the **Credentials provider** with **JWT sessions** (30-day maxAge, 24-hour updateAge). The session token is an httpOnly cookie. On each request, the server calls `getServerSession(authOptions)` to read the decoded JWT. The JWT carries `id`, `isAdmin`, `isGlobal`, `isGlobalViewer`, `mustChangePassword`, and `adminPlantId`.

Three roles are defined by columns on `app_user`:

| Role | `is_admin` | `admin_plant_id` |
|---|---|---|
| Superadmin | `TRUE` | `NULL` |
| Plant admin | `TRUE` | `<plant_id>` |
| Operational | `FALSE` | — |

A fourth flag `is_global` marks read-only global viewers (e.g., general managers) who can see all plants but cannot write or access `/capture` or `/issues`.

Navigation link visibility (from `AppHeader.tsx`) and route-level authorization:

| Route / Link | Superadmin | Plant admin | Operational | Global viewer |
|---|---|---|---|---|
| `/` (Dashboard) | ✓ | ✓ | ✓ | ✓ |
| `/capture` | ✓ | ✓ | ✓ | ✗ |
| `/issues` | ✓ | ✓ | ✓ | ✗ |
| `/admin/users` | ✓ | ✓ | ✗ | ✗ |
| `/admin/metrics` | ✓ | ✓ | ✗ | ✗ |
| `/admin/targets` | ✗ (link hidden; 403 at API) | ✓ | ✗ | ✗ |
| `/admin/thresholds` | ✓ | ✓ | ✗ | ✗ |
| `/admin/logs` | ✓ | ✗ (link hidden; 403 at API) | ✗ | ✗ |
| `/account/change-password` | ✓ | ✓ | ✓ | ✓ |

---

## 7. How to run locally

```bash
npm install

# Create .env.local with the variables listed in section 2.

# Apply migrations — run the SQL files at the project root manually
# against the target PostgreSQL database (see section 9).

npm run dev
```

The dev server starts at **http://localhost:4553** (configured via `--port 4553` in `package.json`).

---

## 8. How to build for production

```bash
npm run build
npm run start
```

The production server also runs on port **4553** (`npm run start` uses `--port 4553`). The `.env.local` file (or equivalent environment variable injection) must be present in the production environment. `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are required at build time and at runtime.

---

## 9. Migrations

All SQL files are located at the project root. There is no dedicated `migrations/` folder.

| File | Description |
|---|---|
| `queries.sql` | Full schema: all tables, indexes, the `trg_audit` trigger function, and the initial month-level scorecard views. Run once against an empty database to create the schema from scratch. |
| `plant_entries.sql` | Initial plant seed data (CHI, FRA, CZE, CHN, BRA, LEO, MAR). |
| `migrate_must_change_password.sql` | Adds the `must_change_password` boolean column to `app_user` and sets it TRUE for all existing rows. |
| `add_owner_text.sql` | Adds the `owner_text VARCHAR(200)` column to `metric_result` for free-text responsible-party names. |
| `migration_d9_yearly_views.sql` | Creates the five yearly-aggregation views: `v_scorecard_cell_yearly`, `v_scorecard_process_total_yearly`, `v_scorecard_area_total_yearly`, `v_scorecard_overall_yearly`, and `v_metric_yearly`. |

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
| `npm run dev` | Start local development server on port 4553 (hot reload) |
| `npm run build` | Compile and bundle for production |
| `npm run start` | Start the production server on port 4553 (requires prior build) |
| `npm run serve` | Build and start in one step (`next build && next start --port 4553`) |
| `npx tsc --noEmit` | Type-check the codebase without emitting files |

---

## 12. What this README does not cover

The following topics are documented separately and are out of scope for this file:

- Business rules (color computation logic, validity flag semantics, owner dual-mode behavior in capture).
- Migration history and the rationale behind each schema change.
- Bugs encountered during development and their fixes.
- Data model decisions and their justification.
