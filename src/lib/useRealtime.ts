'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type SensorLatest, type ActiveAlert, type SensorReading, type HourlySummary } from '@/lib/supabase';

// Hook: latest reading per sensor
// Subscribes to sensor_latest (cache table) instead of sensor_readings (raw).
// Why: sensor_latest has 1 row per sensor, so realtime events are rare and small.
//      sensor_readings could have 100+ inserts/sec which would flood the client.
export function useLatestReadings() {
  const [data, setData] = useState<SensorLatest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLatest = useCallback(async () => {
    const { data: rows } = await supabase
      .from('latest_readings')
      .select('sensor_id, sensor_uuid, name, location, recorded_at, temperature, humidity, quality_score, metadata, threshold_temp_high, threshold_temp_low, threshold_humidity_high, threshold_humidity_low')
      .order('sensor_id');
    if (rows) setData(rows as SensorLatest[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLatest();

    const channel = supabase
      .channel('latest-readings')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sensor_latest' },
        () => { fetchLatest(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLatest]);

  return { data, loading };
}

// Hook: recent readings for a specific sensor (chart data)
// Subscribes to INSERT on sensor_readings, filtered to one sensor.
// Uses throttled append to avoid re-rendering faster than the chart can draw.
export function useSensorHistory(sensorId: number | null, hours = 24) {
  const [data, setData] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const bufferRef = useRef<SensorReading[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!sensorId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    const { data: rows } = await supabase
      .from('sensor_readings')
      .select('id, sensor_id, recorded_at, temperature, humidity, quality_score, metadata')
      .eq('sensor_id', sensorId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });
    if (rows) setData(rows as SensorReading[]);
    setLoading(false);
  }, [sensorId, hours]);

  useEffect(() => {
    fetchHistory();

    if (!sensorId) return;

    const channel = supabase
      .channel(`history-${sensorId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_readings', filter: `sensor_id=eq.${sensorId}` },
        (payload) => {
          bufferRef.current.push(payload.new as SensorReading);

          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              setData(prev => [...prev.slice(-499), ...bufferRef.current]);
              bufferRef.current = [];
              flushTimerRef.current = null;
            }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, [fetchHistory, sensorId]);

  return { data, loading };
}

// Hook: active alerts (realtime)
// Subscribes to events table (low volume — only fires on threshold breach/resolve)
export function useActiveAlerts() {
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchView = async () => {
      const { data: rows } = await supabase
        .from('active_alerts')
        .select('*')
        .limit(20);
      if (rows) setAlerts(rows as ActiveAlert[]);
      setLoading(false);
    };
    fetchView();

    const channel = supabase
      .channel('active-alerts')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => { fetchView(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { alerts, loading };
}

// Hook: hourly summary for charts (fetched on sensor/time change, no realtime needed)
export function useHourlySummary(sensorId: number | null, hours = 24) {
  const [data, setData] = useState<HourlySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sensorId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const since = new Date(Date.now() - hours * 3600000).toISOString();

    supabase
      .from('hourly_summary')
      .select('*')
      .eq('sensor_id', sensorId)
      .gte('hour_start', since)
      .order('hour_start', { ascending: true })
      .then(({ data: rows }) => {
        if (rows) setData(rows as HourlySummary[]);
        setLoading(false);
      });
  }, [sensorId, hours]);

  return { data, loading };
}
