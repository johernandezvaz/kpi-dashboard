-- =============================================================================
-- SCORECARD DATABASE - SCHEMA
-- =============================================================================
-- Migration from MS Access "access_data.accdb" to PostgreSQL 18
-- Target DB: scorecard
-- Target user: scorecard_app
-- =============================================================================
-- All operations inside a single transaction.
-- If anything fails, nothing is created.
BEGIN;
-- =============================================================================
-- SECTION 1 - GLOBAL CATALOGS
-- =============================================================================
-- Plants where this scorecard applies. Each plant is a segmentation tag.
CREATE TABLE plant (
    plant_id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    country CHAR(2) NOT NULL,
    -- ISO 3166-1 alpha-2 ('MX','FR','CZ')
    timezone VARCHAR(50) NOT NULL,
    -- IANA TZ ('America/Chihuahua')
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE plant IS 'Manufacturing plants. Each plant is an independent reporting unit.';
-- Business processes (P1, P2, C3, C4, S1, S5, S6, S9, S10).
CREATE TABLE process (
    process_id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    -- 'P1', 'C4', 'S10'
    name VARCHAR(200) NOT NULL,
    -- English name
    sort_order INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE process IS 'Business processes (Plan/Customer/Support categories).';
-- Functional areas (QC, Logistics, Maintenance, etc.).
CREATE TABLE area (
    area_id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    -- 'QC', 'MAINT', 'TOOL_ROOM'
    name VARCHAR(100) NOT NULL,
    -- English name
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE area IS 'Functional areas within a plant.';
-- Metrics catalog. IDs preserved from legacy Access (1000, 1025, 1030, ...).
CREATE TABLE metric (
    metric_id INT PRIMARY KEY,
    -- Legacy ID preserved
    process_id INT NOT NULL REFERENCES process(process_id),
    area_id INT NOT NULL REFERENCES area(area_id),
    name VARCHAR(300) NOT NULL,
    -- English name
    unit VARCHAR(50),
    -- 'ppm', '%', 'count', NULL
    higher_is_better BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN metric.higher_is_better IS 'TRUE: result >= green_limit is good (e.g. % compliance). FALSE: result <= green_limit is good (e.g. defect ppm).';
CREATE INDEX idx_metric_area ON metric(area_id);
CREATE INDEX idx_metric_process ON metric(process_id);
-- =============================================================================
-- SECTION 2 - USERS AND ACCESS
-- =============================================================================
CREATE TABLE app_user (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    -- bcrypt/argon2 hash, NEVER plain
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    -- Manages catalogs, users
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    -- Read-only access to all plants
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN app_user.password_hash IS 'Argon2id or bcrypt hash. Never store plain text.';
COMMENT ON COLUMN app_user.is_admin IS 'Can manage users, catalogs, and all plants data.';
COMMENT ON COLUMN app_user.is_global IS 'Read-only access to all plants (used for global viewers like the general manager).';
CREATE INDEX idx_user_active ON app_user(active)
WHERE active = TRUE;
-- Per-plant access for non-admin, non-global users.
CREATE TABLE user_plant_access (
    user_id INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    plant_id INT NOT NULL REFERENCES plant(plant_id),
    can_edit BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, plant_id)
);
COMMENT ON TABLE user_plant_access IS 'Plants a user can access. Ignored if user.is_admin or user.is_global is TRUE.';
-- =============================================================================
-- SECTION 3 - SCORECARD CONFIGURATION
-- =============================================================================
-- Color thresholds for the scorecard. Group-wide (not per plant).
-- History preserved via effective_from for retroactive consistency.
CREATE TABLE scorecard_threshold (
    threshold_id SERIAL PRIMARY KEY,
    yellow_min NUMERIC(5, 4) NOT NULL,
    green_min NUMERIC(5, 4) NOT NULL,
    effective_from DATE NOT NULL UNIQUE,
    notes TEXT,
    created_by INT REFERENCES app_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (yellow_min < green_min),
    CHECK (
        yellow_min >= 0
        AND green_min <= 1
    )
);
COMMENT ON TABLE scorecard_threshold IS 'Compliance thresholds for cell coloring. Use the row with the most recent effective_from <= target date.';
-- Initial threshold (agreed with management).
-- < 0.60: red,  >= 0.60 and < 0.75: yellow,  >= 0.75: green
INSERT INTO scorecard_threshold (yellow_min, green_min, effective_from, notes)
VALUES (
        0.6000,
        0.7500,
        '2021-01-01',
        'Initial thresholds agreed at group level.'
    );
-- =============================================================================
-- SECTION 4 - OPERATIONAL DATA
-- =============================================================================
-- Time periods (year + month). Month stored as 1-12, not as string.
CREATE TABLE period (
    period_id SERIAL PRIMARY KEY,
    year SMALLINT NOT NULL,
    month SMALLINT NOT NULL CHECK (
        month BETWEEN 1 AND 12
    ),
    period_date DATE GENERATED ALWAYS AS (make_date(year, month, 1)) STORED,
    UNIQUE (year, month)
);
CREATE INDEX idx_period_date ON period(period_date);
COMMENT ON COLUMN period.period_date IS 'Auto-generated first-of-month date. Use this for date arithmetic and ordering.';
-- Yellow and green limits per (plant, metric, period).
CREATE TABLE metric_target (
    plant_id INT NOT NULL REFERENCES plant(plant_id),
    metric_id INT NOT NULL REFERENCES metric(metric_id),
    period_id INT NOT NULL REFERENCES period(period_id),
    yellow_limit NUMERIC(14, 4) NOT NULL,
    green_limit NUMERIC(14, 4) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INT REFERENCES app_user(user_id),
    PRIMARY KEY (plant_id, metric_id, period_id)
);
CREATE INDEX idx_target_period ON metric_target(period_id);
-- Actual results captured by managers.
CREATE TABLE metric_result (
    result_id BIGSERIAL PRIMARY KEY,
    plant_id INT NOT NULL REFERENCES plant(plant_id),
    metric_id INT NOT NULL REFERENCES metric(metric_id),
    period_id INT NOT NULL REFERENCES period(period_id),
    result_value NUMERIC(14, 4),
    comment TEXT,
    issue TEXT,
    corrective_action TEXT,
    target_date DATE,
    owner_user_id INT REFERENCES app_user(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INT REFERENCES app_user(user_id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INT REFERENCES app_user(user_id),
    UNIQUE (plant_id, metric_id, period_id)
);
CREATE INDEX idx_result_lookup ON metric_result(plant_id, period_id);
CREATE INDEX idx_result_metric ON metric_result(metric_id, period_id);
COMMENT ON TABLE metric_result IS 'Monthly captured values. One row per (plant, metric, period). Updated in place when re-captured.';
-- =============================================================================
-- SECTION 5 - AUDIT LOG
-- =============================================================================
CREATE TABLE audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    -- Stringified PK or composite
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by INT REFERENCES app_user(user_id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_lookup ON audit_log(table_name, record_id, changed_at DESC);
CREATE INDEX idx_audit_user ON audit_log(changed_by, changed_at DESC);
COMMENT ON TABLE audit_log IS 'Append-only audit trail. Populated by triggers on operational tables.';
-- Generic audit trigger function. Reads the user id from the session variable
-- 'app.user_id' which the application must set via SET LOCAL after authentication.
CREATE OR REPLACE FUNCTION trg_audit() RETURNS TRIGGER AS $$
DECLARE v_user_id INT;
v_pk TEXT;
BEGIN -- Pull user id from session; NULL if not set (e.g. during initial migration).
BEGIN v_user_id := current_setting('app.user_id', TRUE)::INT;
EXCEPTION
WHEN OTHERS THEN v_user_id := NULL;
END;
-- Build record_id depending on table.
IF TG_TABLE_NAME = 'metric_result' THEN v_pk := COALESCE(NEW.result_id::TEXT, OLD.result_id::TEXT);
ELSIF TG_TABLE_NAME = 'metric_target' THEN v_pk := CONCAT_WS(
    ':',
    COALESCE(NEW.plant_id::TEXT, OLD.plant_id::TEXT),
    COALESCE(NEW.metric_id::TEXT, OLD.metric_id::TEXT),
    COALESCE(NEW.period_id::TEXT, OLD.period_id::TEXT)
);
ELSE v_pk := '?';
END IF;
IF TG_OP = 'INSERT' THEN
INSERT INTO audit_log(
        table_name,
        record_id,
        action,
        new_data,
        changed_by
    )
VALUES (
        TG_TABLE_NAME,
        v_pk,
        'INSERT',
        to_jsonb(NEW),
        v_user_id
    );
RETURN NEW;
ELSIF TG_OP = 'UPDATE' THEN
INSERT INTO audit_log(
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by
    )
VALUES (
        TG_TABLE_NAME,
        v_pk,
        'UPDATE',
        to_jsonb(OLD),
        to_jsonb(NEW),
        v_user_id
    );
RETURN NEW;
ELSIF TG_OP = 'DELETE' THEN
INSERT INTO audit_log(
        table_name,
        record_id,
        action,
        old_data,
        changed_by
    )
VALUES (
        TG_TABLE_NAME,
        v_pk,
        'DELETE',
        to_jsonb(OLD),
        v_user_id
    );
RETURN OLD;
END IF;
RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_metric_result
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON metric_result FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit_metric_target
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON metric_target FOR EACH ROW EXECUTE FUNCTION trg_audit();
-- =============================================================================
-- SECTION 6 - VIEWS (replace legacy Access queries Q_*)
-- =============================================================================
-- Per-metric score (0/1/2 points) using the metric's higher_is_better flag.
CREATE VIEW v_metric_score AS
SELECT r.result_id,
    r.plant_id,
    r.period_id,
    r.metric_id,
    m.area_id,
    m.process_id,
    r.result_value,
    t.yellow_limit,
    t.green_limit,
    m.higher_is_better,
    CASE
        WHEN r.result_value IS NULL
        OR t.green_limit IS NULL THEN NULL
        WHEN m.higher_is_better THEN CASE
            WHEN r.result_value >= t.green_limit THEN 2
            WHEN r.result_value >= t.yellow_limit THEN 1
            ELSE 0
        END
        ELSE CASE
            WHEN r.result_value <= t.green_limit THEN 2
            WHEN r.result_value <= t.yellow_limit THEN 1
            ELSE 0
        END
    END AS score
FROM metric_result r
    JOIN metric m ON m.metric_id = r.metric_id
    LEFT JOIN metric_target t ON t.plant_id = r.plant_id
    AND t.metric_id = r.metric_id
    AND t.period_id = r.period_id;
COMMENT ON VIEW v_metric_score IS 'Each metric scored 0 (red), 1 (yellow), or 2 (green) based on its target and direction.';
-- Scorecard cell aggregation per (plant, period, area, process).
-- This is what the legacy T_Graph cached. Now calculated on the fly.
CREATE VIEW v_scorecard_cell AS WITH cell AS (
    SELECT plant_id,
        period_id,
        area_id,
        process_id,
        COUNT(score) AS metrics_count,
        SUM(score) AS total_score
    FROM v_metric_score
    WHERE score IS NOT NULL
    GROUP BY plant_id,
        period_id,
        area_id,
        process_id
),
threshold AS (
    -- Most recent threshold row valid for "today".
    -- For historical reporting, replace CURRENT_DATE with the period_date.
    SELECT yellow_min,
        green_min
    FROM scorecard_threshold
    WHERE effective_from <= CURRENT_DATE
    ORDER BY effective_from DESC
    LIMIT 1
)
SELECT c.plant_id,
    c.period_id,
    c.area_id,
    c.process_id,
    c.metrics_count,
    c.total_score,
    c.total_score::NUMERIC / (2 * c.metrics_count) AS compliance_ratio,
    CASE
        WHEN c.total_score::NUMERIC / (2 * c.metrics_count) >= t.green_min THEN 'green'
        WHEN c.total_score::NUMERIC / (2 * c.metrics_count) >= t.yellow_min THEN 'yellow'
        ELSE 'red'
    END AS color
FROM cell c
    CROSS JOIN threshold t;
COMMENT ON VIEW v_scorecard_cell IS 'Compliance ratio and color per (plant, period, area, process). Replaces legacy T_Graph.';
-- "Total" row of the scorecard: aggregation by process across all areas in a plant/period.
CREATE VIEW v_scorecard_process_total AS WITH agg AS (
    SELECT plant_id,
        period_id,
        process_id,
        SUM(total_score) AS total_score,
        SUM(metrics_count) AS metrics_count
    FROM v_scorecard_cell
    GROUP BY plant_id,
        period_id,
        process_id
),
threshold AS (
    SELECT yellow_min,
        green_min
    FROM scorecard_threshold
    WHERE effective_from <= CURRENT_DATE
    ORDER BY effective_from DESC
    LIMIT 1
)
SELECT a.plant_id,
    a.period_id,
    a.process_id,
    a.metrics_count,
    a.total_score,
    a.total_score::NUMERIC / (2 * a.metrics_count) AS compliance_ratio,
    CASE
        WHEN a.total_score::NUMERIC / (2 * a.metrics_count) >= t.green_min THEN 'green'
        WHEN a.total_score::NUMERIC / (2 * a.metrics_count) >= t.yellow_min THEN 'yellow'
        ELSE 'red'
    END AS color
FROM agg a
    CROSS JOIN threshold t;
-- Overall total for a plant/period (top-right corner of the scorecard, e.g. 69.7%).
CREATE VIEW v_scorecard_overall AS WITH agg AS (
    SELECT plant_id,
        period_id,
        SUM(total_score) AS total_score,
        SUM(metrics_count) AS metrics_count
    FROM v_scorecard_cell
    GROUP BY plant_id,
        period_id
),
threshold AS (
    SELECT yellow_min,
        green_min
    FROM scorecard_threshold
    WHERE effective_from <= CURRENT_DATE
    ORDER BY effective_from DESC
    LIMIT 1
)
SELECT a.plant_id,
    a.period_id,
    a.metrics_count,
    a.total_score,
    a.total_score::NUMERIC / (2 * a.metrics_count) AS compliance_ratio,
    CASE
        WHEN a.total_score::NUMERIC / (2 * a.metrics_count) >= t.green_min THEN 'green'
        WHEN a.total_score::NUMERIC / (2 * a.metrics_count) >= t.yellow_min THEN 'yellow'
        ELSE 'red'
    END AS color
FROM agg a
    CROSS JOIN threshold t;
-- =============================================================================
-- DONE
-- =============================================================================
COMMIT;