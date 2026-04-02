'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import type { SensorReading, HourlySummary } from '@/lib/supabase';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Temperature chart with gradient fill
export function TemperatureDetailChart({ history }: {
  history: SensorReading[];
}) {
  const chartData = useMemo(() =>
    history.map(r => ({
      time: formatTime(r.recorded_at),
      temperature: r.temperature,
    })),
    [history]
  );

  if (chartData.length === 0) return <div className="text-gray-500 text-sm text-center py-8">No temperature data</div>;

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b7280' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={['auto', 'auto']} unit="°C" />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(v: unknown) => [`${Number(v).toFixed(1)}°C`, 'Temperature']}
          />
          <Area type="monotone" dataKey="temperature" stroke="#ef4444" strokeWidth={2}
            fill="url(#tempGrad)" dot={false} name="Temperature" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Humidity chart with gradient fill
export function HumidityDetailChart({ history }: { history: SensorReading[] }) {
  const chartData = useMemo(() =>
    history.map(r => ({
      time: formatTime(r.recorded_at),
      humidity: r.humidity,
    })),
    [history]
  );

  if (chartData.length === 0) return <div className="text-gray-500 text-sm text-center py-8">No humidity data</div>;

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b7280' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(v: unknown) => [`${Number(v).toFixed(1)}%`, 'Humidity']}
          />
          <Area type="monotone" dataKey="humidity" stroke="#3b82f6" strokeWidth={2}
            fill="url(#humGrad)" dot={false} name="Humidity" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Hourly range band chart showing min/avg/max for temperature
export function HourlyRangeChart({ hourly }: { hourly: HourlySummary[] }) {
  const chartData = useMemo(() =>
    hourly.map(h => ({
      time: formatTime(h.hour_start),
      avg: h.temp_avg,
      min: h.temp_min,
      max: h.temp_max,
    })),
    [hourly]
  );

  if (chartData.length === 0) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b7280' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={['auto', 'auto']} unit="°C" />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Line type="monotone" dataKey="max" stroke="#f87171" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Max" />
          <Line type="monotone" dataKey="avg" stroke="#ef4444" strokeWidth={2} dot={false} name="Avg" />
          <Line type="monotone" dataKey="min" stroke="#fca5a5" strokeWidth={1} strokeDasharray="4 2" dot={false} name="Min" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
