-- ============================================
-- Smart Greenhouse - Seed Data
-- ============================================

-- Insert sample sensors
INSERT INTO sensors (name, location, sensor_type, threshold_temp_high, threshold_temp_low, threshold_humidity_high, threshold_humidity_low) VALUES
    ('Greenhouse Zone A', 'North Section',  'combined',      35.0, 10.0, 80.0, 30.0),
    ('Greenhouse Zone B', 'South Section',  'combined',      35.0, 10.0, 80.0, 30.0),
    ('Greenhouse Zone C', 'East Section',   'temperature',   32.0,  8.0, NULL, NULL),
    ('Seedling Tray',     'Propagation',    'humidity',      30.0, 15.0, 85.0, 50.0),
    ('Outdoor Weather',   'Rooftop',        'combined',      40.0,  0.0, 95.0, 10.0);

-- Insert 24h of historical readings (one per 10 min per sensor)
-- Triggers will automatically populate sensor_latest, sensor_readings_hourly, and events
INSERT INTO sensor_readings (sensor_id, recorded_at, temperature, humidity, quality_score, metadata)
SELECT
    s.id,
    ts,
    ROUND((22 + (random() * 8 - 4))::numeric, 2),
    ROUND((55 + (random() * 20 - 10))::numeric, 2),
    (90 + floor(random() * 11))::smallint,
    '{"seed": true}'::jsonb
FROM sensors s
CROSS JOIN generate_series(
    NOW() - INTERVAL '24 hours',
    NOW(),
    INTERVAL '10 minutes'
) AS ts
WHERE s.is_active = true;
