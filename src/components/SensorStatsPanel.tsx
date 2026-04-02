'use client';

import type { SensorLatest, HourlySummary } from '@/lib/supabase';

export default function SensorStatsPanel({ sensor, hourly, timeRange }: {
  sensor: SensorLatest;
  hourly: HourlySummary[];
  timeRange: number;
}) {
  const rangeMs = timeRange * 3600000;
  const rangeLabel = timeRange >= 24 ? `${timeRange / 24}d` : `${timeRange}h`;
  const lastRange = hourly.filter(h => new Date(h.hour_start).getTime() > Date.now() - rangeMs);

  const temps = lastRange.map(h => h.temp_avg).filter((t): t is number => t !== null);
  const hums = lastRange.map(h => h.humidity_avg).filter((h): h is number => h !== null);
  const totalReadings = lastRange.reduce((sum, h) => sum + (h.reading_count || 0), 0);

  const avgTemp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : '--';
  const minTemp = temps.length ? Math.min(...temps).toFixed(1) : '--';
  const maxTemp = temps.length ? Math.max(...temps).toFixed(1) : '--';

  const avgHum = hums.length ? (hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(1) : '--';
  const minHum = hums.length ? Math.min(...hums).toFixed(1) : '--';
  const maxHum = hums.length ? Math.max(...hums).toFixed(1) : '--';

  // Trend: compare last 3 hours avg vs 3-6 hours ago
  const now = Date.now();
  const recent = lastRange.filter(h => new Date(h.hour_start).getTime() > now - 3 * 3600000);
  const earlier = lastRange.filter(h => {
    const t = new Date(h.hour_start).getTime();
    return t > now - 6 * 3600000 && t <= now - 3 * 3600000;
  });

  const recentTemp = recent.map(h => h.temp_avg).filter((t): t is number => t !== null);
  const earlierTemp = earlier.map(h => h.temp_avg).filter((t): t is number => t !== null);

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (recentTemp.length && earlierTemp.length) {
    const diff = (recentTemp.reduce((a, b) => a + b, 0) / recentTemp.length) -
                 (earlierTemp.reduce((a, b) => a + b, 0) / earlierTemp.length);
    if (diff > 0.5) trend = 'up';
    else if (diff < -0.5) trend = 'down';
  }

  return (
    <div className="space-y-4">
      {/* Current + trend */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Current Temp</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {sensor.temperature !== null ? `${sensor.temperature}°` : '--'}
            </span>
            <span className={`text-sm font-medium ${trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-blue-400' : 'text-gray-500'}`}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            </span>
          </div>
          <div className="text-[10px] text-gray-500">
            {rangeLabel} range: {minTemp}° — {maxTemp}°
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Current Humidity</div>
          <div className="text-2xl font-bold font-mono text-white">
            {sensor.humidity !== null ? `${sensor.humidity}%` : '--'}
          </div>
          <div className="text-[10px] text-gray-500">
            {rangeLabel} range: {minHum}% — {maxHum}%
          </div>
        </div>
      </div>

      {/* Range Averages */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-800/30 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">{rangeLabel} Avg</div>
          <div className="text-sm font-mono text-white">{avgTemp}°</div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">{rangeLabel} Min</div>
          <div className="text-sm font-mono text-blue-400">{minTemp}°</div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">{rangeLabel} Max</div>
          <div className="text-sm font-mono text-red-400">{maxTemp}°</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-800/30 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">{rangeLabel} Avg</div>
          <div className="text-sm font-mono text-white">{avgHum}%</div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">{rangeLabel} Min</div>
          <div className="text-sm font-mono text-yellow-400">{minHum}%</div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">{rangeLabel} Max</div>
          <div className="text-sm font-mono text-orange-400">{maxHum}%</div>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-gray-800/30 rounded-lg p-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Total readings ({rangeLabel}): </span>
            <span className="text-gray-300">{totalReadings.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Quality score: </span>
            <span className={`font-medium ${sensor.quality_score && sensor.quality_score >= 90 ? 'text-green-400' : sensor.quality_score && sensor.quality_score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
              {sensor.quality_score ?? '--'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Location: </span>
            <span className="text-gray-300">{sensor.location || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500">Last update: </span>
            <span className="text-gray-300">
              {sensor.recorded_at ? new Date(sensor.recorded_at).toLocaleTimeString() : '--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
