import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types
export interface Sensor {
  id: number;
  uuid: string;
  name: string;
  location: string | null;
  sensor_type: string;
  is_active: boolean;
  threshold_temp_high: number;
  threshold_temp_low: number;
  threshold_humidity_high: number;
  threshold_humidity_low: number;
  created_at: string;
}

export interface SensorReading {
  id: number;
  sensor_id: number;
  recorded_at: string;
  temperature: number | null;
  humidity: number | null;
  quality_score: number;
  metadata: Record<string, unknown> | null;
}

export interface SensorLatest {
  sensor_id: number;
  sensor_uuid: string;
  name: string;
  location: string | null;
  recorded_at: string;
  temperature: number | null;
  humidity: number | null;
  quality_score: number;
  metadata: Record<string, unknown> | null;
  threshold_temp_high: number | null;
  threshold_temp_low: number | null;
  threshold_humidity_high: number | null;
  threshold_humidity_low: number | null;
}

export interface Event {
  id: number;
  sensor_id: number;
  event_type: string;
  value: number | null;
  threshold: number | null;
  message: string | null;
  is_resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface ActiveAlert {
  id: number;
  sensor_id: number;
  sensor_name: string;
  location: string | null;
  event_type: string;
  value: number | null;
  threshold: number | null;
  message: string | null;
  created_at: string;
}

export interface HourlySummary {
  sensor_id: number;
  name: string;
  location: string | null;
  hour_start: string;
  temp_avg: number | null;
  temp_min: number | null;
  temp_max: number | null;
  humidity_avg: number | null;
  humidity_min: number | null;
  humidity_max: number | null;
  reading_count: number;
}
