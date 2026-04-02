-- ============================================
-- Smart Greenhouse Monitoring - Supabase Schema
-- ============================================
-- Adapted for Supabase (no partitioning, RLS enabled, Realtime ready)
-- Run this in the Supabase SQL Editor
--
-- Schema order:
--   1. Extensions + types
--   2. Tables (sensors, sensor_readings, sensor_latest, sensor_readings_hourly, events)
--   3. Indexes
--   4. Triggers + functions
--   5. RLS policies
--   6. Views

-- ============================================
-- 1. EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  -- Supabase default

-- ============================================
-- 2. TABLES
-- ============================================

-- Sensors (reference data)
CREATE TABLE sensors (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid        UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    name        VARCHAR(100)    NOT NULL,
    location    VARCHAR(100),
    sensor_type VARCHAR(50)     NOT NULL DEFAULT 'combined',
    is_active   BOOLEAN         NOT NULL DEFAULT true,
    threshold_temp_high REAL DEFAULT 35.0,  -- Alert threshold
    threshold_temp_low  REAL DEFAULT 10.0,
    threshold_humidity_high REAL DEFAULT 80.0,
    threshold_humidity_low  REAL DEFAULT 30.0,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Sensor readings (time-series main table)
-- Uses REAL (4-byte float) instead of NUMERIC for faster inserts and smaller storage.
-- NUMERIC does exact arithmetic (slow), REAL uses native CPU float (fast).
-- Trade-off: REAL has ~6 significant digits of precision (more than enough for sensor data).
CREATE TABLE sensor_readings (
    id            BIGINT GENERATED ALWAYS AS IDENTITY,
    sensor_id     INTEGER    NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    temperature   REAL,           -- fast 4-byte float (vs 8-byte NUMERIC)
    humidity      REAL,
    quality_score SMALLINT   NOT NULL DEFAULT 100 CHECK (quality_score BETWEEN 0 AND 100),
    metadata      JSONB,
    PRIMARY KEY (id, recorded_at)
);

-- Latest reading cache (1 row per sensor, trigger-maintained)
CREATE TABLE sensor_latest (
    sensor_id     INTEGER    NOT NULL PRIMARY KEY REFERENCES sensors(id) ON DELETE CASCADE,
    reading_id    BIGINT     NOT NULL,
    recorded_at   TIMESTAMPTZ NOT NULL,
    temperature   REAL,
    humidity      REAL,
    quality_score SMALLINT,
    metadata      JSONB,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hourly aggregations (trigger-maintained + backfill)
CREATE TABLE sensor_readings_hourly (
    sensor_id     INTEGER    NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    hour_start    TIMESTAMPTZ NOT NULL,
    temp_avg      REAL,
    temp_min      REAL,
    temp_max      REAL,
    humidity_avg  REAL,
    humidity_min  REAL,
    humidity_max  REAL,
    reading_count INTEGER    NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sensor_id, hour_start)
);

-- Events / Alerts (stateful with cooldown to avoid duplicates)
CREATE TABLE events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sensor_id   INTEGER     NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL,  -- 'high_temp', 'low_temp', 'high_humidity', 'low_humidity', 'sensor_offline'
    value       REAL,
    threshold   REAL,
    message     TEXT,
    is_resolved BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- ============================================
-- 3. INDEXES
-- ============================================

-- sensor_readings: BRIN for time-range scans (tiny: ~128KB per 1M rows)
-- pages_per_range=32 for higher granularity (good for high insert rates)
CREATE INDEX idx_readings_time_brin ON sensor_readings
    USING BRIN (recorded_at) WITH (pages_per_range = 32);

-- sensor_readings: per-sensor time lookups (main query pattern)
CREATE INDEX idx_readings_sensor_time ON sensor_readings (sensor_id, recorded_at DESC);

-- sensor_latest: dashboard listing
CREATE INDEX idx_latest_updated ON sensor_latest (updated_at DESC) INCLUDE (temperature, humidity);

-- sensor_readings_hourly: historical queries
CREATE INDEX idx_hourly_time ON sensor_readings_hourly (hour_start DESC);

-- events: resolve matching — one index serves both "find open" and "resolve"
CREATE INDEX idx_events_unresolved ON events (sensor_id, event_type)
    WHERE is_resolved = false;

-- HOT-update optimization: append-only table benefits from lower fillfactor
-- This leaves free space in each page so UPDATEs (from trigger) don't cause page splits
-- For sensor_latest (1 row per sensor, frequently updated)
ALTER TABLE sensor_latest SET (fillfactor = 90);

-- For sensor_readings_hourly (1 row per sensor per hour, frequently updated)
ALTER TABLE sensor_readings_hourly SET (fillfactor = 90);

-- For events (rarely updated except is_resolved flip)
ALTER TABLE events SET (fillfactor = 95);

-- ============================================
-- 4. FUNCTIONS & TRIGGERS
-- ============================================
-- All triggers are STATEMENT-LEVEL with REFERENCING NEW TABLE AS new_rows.
-- This means a bulk INSERT of 100 rows fires the trigger ONCE, not 100 times.
--
-- Key optimizations for high-frequency inserts:
--   - Sensor thresholds cached in CTE (1 lookup, not N per row)
--   - DISTINCT ON for latest (one UPSERT per sensor, not per row)
--   - GROUP BY for hourly (one UPSERT per sensor-hour, not per row)
--   - Event detection uses set-based logic, not loops

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sensors_updated_at
    BEFORE UPDATE ON sensors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -------------------------------------------
-- Trigger 1: Maintain sensor_latest
-- -------------------------------------------
-- Picks the most recent reading per sensor from the batch, then UPSERTs.
-- One statement regardless of batch size.
CREATE OR REPLACE FUNCTION trg_maintain_latest()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO sensor_latest (sensor_id, reading_id, recorded_at, temperature, humidity, quality_score, metadata, updated_at)
    SELECT DISTINCT ON (sensor_id)
        sensor_id, id, recorded_at, temperature, humidity, quality_score, metadata, now()
    FROM new_rows
    ORDER BY sensor_id, recorded_at DESC
    ON CONFLICT (sensor_id) DO UPDATE SET
        reading_id    = EXCLUDED.reading_id,
        recorded_at   = EXCLUDED.recorded_at,
        temperature   = EXCLUDED.temperature,
        humidity      = EXCLUDED.humidity,
        quality_score = EXCLUDED.quality_score,
        metadata      = EXCLUDED.metadata,
        updated_at    = now()
    WHERE EXCLUDED.recorded_at > sensor_latest.recorded_at;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------
-- Trigger 2: Maintain hourly aggregation
-- -------------------------------------------
-- Groups all new rows by (sensor_id, hour), aggregates, then UPSERTs.
-- Reading count uses atomic addition to avoid drift from iterative division.
CREATE OR REPLACE FUNCTION trg_maintain_hourly()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO sensor_readings_hourly (sensor_id, hour_start, temp_avg, temp_min, temp_max,
        humidity_avg, humidity_min, humidity_max, reading_count, updated_at)
    SELECT
        sensor_id,
        DATE_TRUNC('hour', recorded_at),
        AVG(temperature),
        MIN(temperature),
        MAX(temperature),
        AVG(humidity),
        MIN(humidity),
        MAX(humidity),
        COUNT(*),
        now()
    FROM new_rows
    GROUP BY sensor_id, DATE_TRUNC('hour', recorded_at)
    ON CONFLICT (sensor_id, hour_start) DO UPDATE SET
        temp_avg      = EXCLUDED.temp_avg,
        temp_min      = LEAST(sensor_readings_hourly.temp_min, EXCLUDED.temp_min),
        temp_max      = GREATEST(sensor_readings_hourly.temp_max, EXCLUDED.temp_max),
        humidity_avg  = EXCLUDED.humidity_avg,
        humidity_min  = LEAST(sensor_readings_hourly.humidity_min, EXCLUDED.humidity_min),
        humidity_max  = GREATEST(sensor_readings_hourly.humidity_max, EXCLUDED.humidity_max),
        reading_count = sensor_readings_hourly.reading_count + EXCLUDED.reading_count,
        updated_at    = now();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------
-- Trigger 3: Detect threshold events (set-based, no loops)
-- -------------------------------------------
-- Joins new_rows against sensor thresholds in ONE pass.
-- Uses DISTINCT ON (sensor_id) to evaluate the LATEST reading per sensor only.
-- Event detection + auto-resolve are separate statements, each with their own CTE.
CREATE OR REPLACE FUNCTION trg_detect_events()
RETURNS TRIGGER AS $$
BEGIN
    -- Step 1: Fire alerts for threshold breaches
    -- CTE is scoped to this single INSERT statement
    INSERT INTO events (sensor_id, event_type, value, threshold, message)
    WITH latest_in_batch AS (
        SELECT DISTINCT ON (nr.sensor_id)
            nr.sensor_id, nr.temperature, nr.humidity
        FROM new_rows nr
        ORDER BY nr.sensor_id, nr.recorded_at DESC
    ),
    checks AS (
        SELECT lb.sensor_id, lb.temperature, lb.humidity,
               s.threshold_temp_high, s.threshold_temp_low,
               s.threshold_humidity_high, s.threshold_humidity_low
        FROM latest_in_batch lb
        JOIN sensors s ON s.id = lb.sensor_id
    )
    SELECT sensor_id, event_type, value, threshold, message
    FROM (
        SELECT sensor_id, 'high_temp'::varchar(50), temperature, threshold_temp_high,
               'Temperature ' || temperature || ' exceeds ' || threshold_temp_high
        FROM checks WHERE temperature > threshold_temp_high
        UNION ALL
        SELECT sensor_id, 'low_temp'::varchar(50), temperature, threshold_temp_low,
               'Temperature ' || temperature || ' below ' || threshold_temp_low
        FROM checks WHERE temperature < threshold_temp_low
        UNION ALL
        SELECT sensor_id, 'high_humidity'::varchar(50), humidity, threshold_humidity_high,
               'Humidity ' || humidity || ' exceeds ' || threshold_humidity_high
        FROM checks WHERE humidity > threshold_humidity_high
        UNION ALL
        SELECT sensor_id, 'low_humidity'::varchar(50), humidity, threshold_humidity_low,
               'Humidity ' || humidity || ' below ' || threshold_humidity_low
        FROM checks WHERE humidity < threshold_humidity_low
    ) AS alerts(sensor_id, event_type, value, threshold, message)
    WHERE NOT EXISTS (
        SELECT 1 FROM events e
        WHERE e.sensor_id = alerts.sensor_id
          AND e.event_type = alerts.event_type
          AND e.is_resolved = false
    );

    -- Step 2: Auto-resolve alerts where readings returned to normal
    -- Separate statement with its own CTE (can't reuse across statements in PL/pgSQL)
    UPDATE events e SET is_resolved = true, resolved_at = now()
    FROM (
        SELECT DISTINCT ON (nr.sensor_id)
            nr.sensor_id, nr.temperature, nr.humidity,
            s.threshold_temp_high, s.threshold_temp_low,
            s.threshold_humidity_high, s.threshold_humidity_low
        FROM new_rows nr
        JOIN sensors s ON s.id = nr.sensor_id
        ORDER BY nr.sensor_id, nr.recorded_at DESC
    ) AS c
    WHERE e.sensor_id = c.sensor_id
      AND e.is_resolved = false
      AND (
        (e.event_type = 'high_temp'     AND c.temperature <= c.threshold_temp_high) OR
        (e.event_type = 'low_temp'      AND c.temperature >= c.threshold_temp_low) OR
        (e.event_type = 'high_humidity' AND c.humidity <= c.threshold_humidity_high) OR
        (e.event_type = 'low_humidity'  AND c.humidity >= c.threshold_humidity_low)
      );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers (AFTER INSERT, statement-level for batch efficiency)
CREATE TRIGGER trg_readings_latest
    AFTER INSERT ON sensor_readings
    REFERENCING NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION trg_maintain_latest();

CREATE TRIGGER trg_readings_hourly
    AFTER INSERT ON sensor_readings
    REFERENCING NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION trg_maintain_hourly();

CREATE TRIGGER trg_readings_events
    AFTER INSERT ON sensor_readings
    REFERENCING NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION trg_detect_events();

-- ============================================
-- 5. ROW LEVEL SECURITY (Supabase requires this)
-- ============================================

ALTER TABLE sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Public read access (for dashboard)
CREATE POLICY "Public read sensors" ON sensors
    FOR SELECT USING (true);

CREATE POLICY "Public read readings" ON sensor_readings
    FOR SELECT USING (true);

CREATE POLICY "Public read latest" ON sensor_latest
    FOR SELECT USING (true);

CREATE POLICY "Public read hourly" ON sensor_readings_hourly
    FOR SELECT USING (true);

CREATE POLICY "Public read events" ON events
    FOR SELECT USING (true);

-- Service role can insert (used by simulator / API)
-- Using anon key for simplicity in this portfolio project
CREATE POLICY "Service insert readings" ON sensor_readings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service insert sensors" ON sensors
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service update sensors" ON sensors
    FOR UPDATE USING (true);

CREATE POLICY "Service update events" ON events
    FOR UPDATE USING (true);

CREATE POLICY "Service insert events" ON events
    FOR INSERT WITH CHECK (true);

-- Triggers run as the calling user (anon), so cache tables need INSERT + UPDATE
CREATE POLICY "Trigger insert latest" ON sensor_latest
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Trigger update latest" ON sensor_latest
    FOR UPDATE USING (true);
CREATE POLICY "Trigger insert hourly" ON sensor_readings_hourly
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Trigger update hourly" ON sensor_readings_hourly
    FOR UPDATE USING (true);

-- ============================================
-- 6. VIEWS
-- ============================================

-- Dashboard: latest reading per sensor
CREATE VIEW latest_readings AS
SELECT
    sl.sensor_id,
    s.uuid AS sensor_uuid,
    s.name,
    s.location,
    sl.recorded_at,
    sl.temperature,
    sl.humidity,
    sl.quality_score,
    sl.metadata,
    s.threshold_temp_high,
    s.threshold_temp_low,
    s.threshold_humidity_high,
    s.threshold_humidity_low
FROM sensor_latest sl
JOIN sensors s ON sl.sensor_id = s.id
WHERE s.is_active = true;

-- Dashboard: active alerts only
CREATE VIEW active_alerts AS
SELECT
    e.id,
    e.sensor_id,
    s.name AS sensor_name,
    s.location,
    e.event_type,
    e.value,
    e.threshold,
    e.message,
    e.created_at
FROM events e
JOIN sensors s ON e.sensor_id = s.id
WHERE e.is_resolved = false
ORDER BY e.created_at DESC;

-- Dashboard: hourly summary
CREATE VIEW hourly_summary AS
SELECT
    s.id AS sensor_id,
    s.name,
    s.location,
    h.hour_start,
    h.temp_avg,
    h.temp_min,
    h.temp_max,
    h.humidity_avg,
    h.humidity_min,
    h.humidity_max,
    h.reading_count
FROM sensors s
JOIN sensor_readings_hourly h ON s.id = h.sensor_id
WHERE s.is_active = true;

-- ============================================
-- 7. REALTIME ENABLEMENT
-- ============================================
-- Supabase Realtime: enable broadcast on these tables
-- Run via Supabase Dashboard > Database > Replication
-- OR use these SQL commands:

ALTER PUBLICATION supabase_realtime ADD TABLE sensor_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE sensor_latest;
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE sensors IS 'Sensor devices registered in the system';
COMMENT ON TABLE sensor_readings IS 'Time-series sensor data (temperature, humidity)';
COMMENT ON TABLE sensor_latest IS 'Cache: 1 row per sensor with latest reading (trigger-maintained)';
COMMENT ON TABLE sensor_readings_hourly IS 'Hourly aggregations for historical analysis (trigger-maintained)';
COMMENT ON TABLE events IS 'Alerts/events with deduplication via is_resolved state';
