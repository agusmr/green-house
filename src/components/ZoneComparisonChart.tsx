'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import type { SensorLatest } from '@/lib/supabase';

interface HistoryMap { [sensorId: number]: { recorded_at: string; temperature: number | null }[] }

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function ZoneComparisonChart({ sensors, historyMap }: {
  sensors: SensorLatest[];
  historyMap: HistoryMap;
}) {
  const chartData = useMemo(() => {
    // Build unified timeline from all sensors, bucketed to 10-min intervals
    const bucketMap = new Map<string, Record<string, number | null>>();

    for (const sensor of sensors) {
      const readings = historyMap[sensor.sensor_id] || [];
      for (const r of readings) {
        if (r.temperature === null) continue;
        const d = new Date(r.recorded_at);
        const bucket = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), Math.floor(d.getMinutes() / 10) * 10)
          .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!bucketMap.has(bucket)) bucketMap.set(bucket, {});
        bucketMap.get(bucket)![sensor.name] = r.temperature;
      }
    }

    return Array.from(bucketMap.entries())
      .map(([time, values]) => ({ time, ...values }))
      .slice(-144); // last 24h at 10-min intervals
  }, [sensors, historyMap]);

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No comparison data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b7280' }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={['auto', 'auto']} unit="°" />
        <Tooltip
          contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#9ca3af' }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {sensors.map((s, i) => (
          <Line key={s.sensor_id} type="monotone" dataKey={s.name}
            stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
