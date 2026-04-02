'use client';

import { Thermometer, Droplets, AlertTriangle, Wifi } from 'lucide-react';
import type { SensorLatest, ActiveAlert } from '@/lib/supabase';

export default function StatsBar({ sensors, alerts }: {
  sensors: SensorLatest[];
  alerts: ActiveAlert[];
}) {
  const tempValues = sensors.map(s => s.temperature).filter((t): t is number => t !== null);
  const humValues = sensors.map(s => s.humidity).filter((h): h is number => h !== null);

  const avgTemp = tempValues.length ? (tempValues.reduce((a, b) => a + b, 0) / tempValues.length).toFixed(1) : '--';
  const avgHum = humValues.length ? (humValues.reduce((a, b) => a + b, 0) / humValues.length).toFixed(1) : '--';

  const maxTemp = tempValues.length ? Math.max(...tempValues).toFixed(1) : '--';
  const minTemp = tempValues.length ? Math.min(...tempValues).toFixed(1) : '--';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <Wifi className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-gray-400">Active Sensors</span>
        </div>
        <div className="text-2xl font-bold text-white">{sensors.length}</div>
        <div className="text-[10px] text-gray-500 mt-1">zones monitored</div>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className={`w-4 h-4 ${alerts.length > 0 ? 'text-red-400' : 'text-gray-600'}`} />
          <span className="text-xs text-gray-400">Active Alerts</span>
        </div>
        <div className={`text-2xl font-bold ${alerts.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
          {alerts.length}
        </div>
        <div className="text-[10px] text-gray-500 mt-1">
          {alerts.length > 0 ? `${new Set(alerts.map(a => a.sensor_id)).size} sensor(s) affected` : 'all clear'}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <Thermometer className="w-4 h-4 text-orange-400" />
          <span className="text-xs text-gray-400">Avg Temperature</span>
        </div>
        <div className="text-2xl font-bold font-mono text-white">{avgTemp}°</div>
        <div className="text-[10px] text-gray-500 mt-1">
          range: {minTemp}° — {maxTemp}°
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <Droplets className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-gray-400">Avg Humidity</span>
        </div>
        <div className="text-2xl font-bold font-mono text-white">{avgHum}%</div>
        <div className="text-[10px] text-gray-500 mt-1">
          {humValues.length ? `${Math.min(...humValues).toFixed(1)}% — ${Math.max(...humValues).toFixed(1)}%` : '--'}
        </div>
      </div>
    </div>
  );
}
