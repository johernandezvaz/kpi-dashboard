CREATE OR REPLACE VIEW v_scorecard_cell_yearly AS
SELECT
    mr.plant_id,
    EXTRACT(YEAR FROM p.period_date)::int          AS year,
    m.area_id,
    m.process_id,
    COUNT(mr.metric_id)                            AS metrics_count,
    SUM(
        CASE
            WHEN m.higher_is_better THEN
                CASE WHEN mr.result_value >= mt.green_limit  THEN 2
                     WHEN mr.result_value >= mt.yellow_limit THEN 1
                     ELSE 0 END
            ELSE
                CASE WHEN mr.result_value <= mt.green_limit  THEN 2
                     WHEN mr.result_value <= mt.yellow_limit THEN 1
                     ELSE 0 END
        END
    )                                              AS total_score,
    ROUND(
        SUM(
            CASE
                WHEN m.higher_is_better THEN
                    CASE WHEN mr.result_value >= mt.green_limit  THEN 2
                         WHEN mr.result_value >= mt.yellow_limit THEN 1
                         ELSE 0 END
                ELSE
                    CASE WHEN mr.result_value <= mt.green_limit  THEN 2
                         WHEN mr.result_value <= mt.yellow_limit THEN 1
                         ELSE 0 END
            END
        )::numeric / NULLIF(2 * COUNT(mr.metric_id), 0),
        4
    )                                              AS compliance_ratio,
    CASE
        WHEN ROUND(
            SUM(
                CASE
                    WHEN m.higher_is_better THEN
                        CASE WHEN mr.result_value >= mt.green_limit  THEN 2
                             WHEN mr.result_value >= mt.yellow_limit THEN 1
                             ELSE 0 END
                    ELSE
                        CASE WHEN mr.result_value <= mt.green_limit  THEN 2
                             WHEN mr.result_value <= mt.yellow_limit THEN 1
                             ELSE 0 END
                END
            )::numeric / NULLIF(2 * COUNT(mr.metric_id), 0),
            4
        ) >= (SELECT green_min FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1)
            THEN 'green'
        WHEN ROUND(
            SUM(
                CASE
                    WHEN m.higher_is_better THEN
                        CASE WHEN mr.result_value >= mt.green_limit  THEN 2
                             WHEN mr.result_value >= mt.yellow_limit THEN 1
                             ELSE 0 END
                    ELSE
                        CASE WHEN mr.result_value <= mt.green_limit  THEN 2
                             WHEN mr.result_value <= mt.yellow_limit THEN 1
                             ELSE 0 END
                END
            )::numeric / NULLIF(2 * COUNT(mr.metric_id), 0),
            4
        ) >= (SELECT yellow_min FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1)
            THEN 'yellow'
        ELSE 'red'
    END                                            AS color
FROM metric_result mr
JOIN metric         m  ON m.metric_id  = mr.metric_id
JOIN period         p  ON p.period_id  = mr.period_id
JOIN metric_target  mt ON mt.plant_id  = mr.plant_id
                       AND mt.metric_id = mr.metric_id
                       AND mt.period_id = mr.period_id
WHERE mr.result_value IS NOT NULL
GROUP BY mr.plant_id, EXTRACT(YEAR FROM p.period_date)::int, m.area_id, m.process_id;

CREATE OR REPLACE VIEW v_scorecard_process_total_yearly AS
SELECT
    plant_id,
    year,
    process_id,
    SUM(metrics_count)                                                    AS metrics_count,
    SUM(total_score)                                                      AS total_score,
    ROUND(SUM(total_score)::numeric / NULLIF(2 * SUM(metrics_count), 0), 4) AS compliance_ratio,
    CASE
        WHEN ROUND(SUM(total_score)::numeric / NULLIF(2 * SUM(metrics_count), 0), 4)
             >= (SELECT green_min  FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'green'
        WHEN ROUND(SUM(total_score)::numeric / NULLIF(2 * SUM(metrics_count), 0), 4)
             >= (SELECT yellow_min FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'yellow'
        ELSE 'red'
    END                                                                   AS color
FROM v_scorecard_cell_yearly
GROUP BY plant_id, year, process_id;

CREATE OR REPLACE VIEW v_scorecard_area_total_yearly AS
SELECT
    plant_id,
    year,
    area_id,
    SUM(metrics_count)                                                    AS metrics_count,
    SUM(total_score)                                                      AS total_score,
    ROUND(SUM(total_score)::numeric / NULLIF(2 * SUM(metrics_count), 0), 4) AS compliance_ratio,
    CASE
        WHEN ROUND(SUM(total_score)::numeric / NULLIF(2 * SUM(metrics_count), 0), 4)
             >= (SELECT green_min  FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'green'
        WHEN ROUND(SUM(total_score)::numeric / NULLIF(2 * SUM(metrics_count), 0), 4)
             >= (SELECT yellow_min FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'yellow'
        ELSE 'red'
    END                                                                   AS color
FROM v_scorecard_cell_yearly
GROUP BY plant_id, year, area_id;

CREATE OR REPLACE VIEW v_scorecard_overall_yearly AS
SELECT
    plant_id,
    year,
    SUM(metrics_count)                                                    AS metrics_count,
    SUM(total_score)                                                      AS total_score,
    ROUND(SUM(total_score)::numeric / NULLIF(2 * SUM(metrics_count), 0), 4) AS compliance_ratio,
    CASE
        WHEN ROUND(SUM(total_score)::numeric / NULLIF(2 * SUM(metrics_count), 0), 4)
             >= (SELECT green_min  FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'green'
        WHEN ROUND(SUM(total_score)::numeric / NULLIF(2 * SUM(metrics_count), 0), 4)
             >= (SELECT yellow_min FROM scorecard_threshold WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) THEN 'yellow'
        ELSE 'red'
    END                                                                   AS color
FROM v_scorecard_cell_yearly
GROUP BY plant_id, year;

CREATE OR REPLACE VIEW v_metric_yearly AS
SELECT
    mr.plant_id,
    EXTRACT(YEAR FROM p.period_date)::int                                 AS year,
    mr.metric_id,
    m.area_id,
    m.process_id,
    m.name,
    m.unit,
    m.higher_is_better,
    AVG(mr.result_value)                                                  AS aggregated_value,
    MAX(mt.yellow_limit)                                                  AS yellow_limit,
    MAX(mt.green_limit)                                                   AS green_limit,
    CASE
        WHEN m.higher_is_better THEN
            CASE WHEN AVG(mr.result_value) >= MAX(mt.green_limit)  THEN 'green'
                 WHEN AVG(mr.result_value) >= MAX(mt.yellow_limit) THEN 'yellow'
                 ELSE 'red' END
        ELSE
            CASE WHEN AVG(mr.result_value) <= MAX(mt.green_limit)  THEN 'green'
                 WHEN AVG(mr.result_value) <= MAX(mt.yellow_limit) THEN 'yellow'
                 ELSE 'red' END
    END                                                                   AS color
FROM metric_result mr
JOIN metric        m  ON m.metric_id  = mr.metric_id
JOIN period        p  ON p.period_id  = mr.period_id
JOIN metric_target mt ON mt.plant_id  = mr.plant_id
                      AND mt.metric_id = mr.metric_id
                      AND mt.period_id = mr.period_id
WHERE mr.result_value IS NOT NULL
GROUP BY mr.plant_id, EXTRACT(YEAR FROM p.period_date)::int, mr.metric_id, m.area_id, m.process_id, m.name, m.unit, m.higher_is_better;
