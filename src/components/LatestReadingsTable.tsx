'use client';

import type { SensorReading } from '@/lib/supabase';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function LatestReadingsTable({ data, tempHigh, tempLow, humHigh, humLow }: {
  data: SensorReading[];
  tempHigh: number | null;
  tempLow: number | null;
  humHigh: number | null;
  humLow: number | null;
}) {
  if (data.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-xs border-b border-gray-800">
            <th className="text-left pb-2 font-medium">Time</th>
            <th className="text-right pb-2 font-medium">Temp</th>
            <th className="text-right pb-2 font-medium">Humidity</th>
            <th className="text-right pb-2 font-medium">Quality</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(-20).reverse().map(r => (
            <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-1.5 text-gray-300">
                <span className="text-gray-500 mr-1">{formatDate(r.recorded_at)}</span>
                {formatTime(r.recorded_at)}
              </td>
              <td className="py-1.5 text-right font-mono">
                <span className={
                  r.temperature !== null && tempHigh !== null && r.temperature > tempHigh ? 'text-red-400'
                  : r.temperature !== null && tempLow !== null && r.temperature < tempLow ? 'text-blue-400'
                  : 'text-white'
                }>
                  {r.temperature !== null ? `${r.temperature}°C` : '--'}
                </span>
              </td>
              <td className="py-1.5 text-right font-mono">
                <span className={
                  r.humidity !== null && humHigh !== null && r.humidity > humHigh ? 'text-orange-400'
                  : r.humidity !== null && humLow !== null && r.humidity < humLow ? 'text-yellow-400'
                  : 'text-white'
                }>
                  {r.humidity !== null ? `${r.humidity}%` : '--'}
                </span>
              </td>
              <td className="py-1.5 text-right">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  r.quality_score >= 90 ? 'bg-green-900/40 text-green-400' :
                  r.quality_score >= 70 ? 'bg-yellow-900/40 text-yellow-400' :
                  'bg-red-900/40 text-red-400'
                }`}>
                  {r.quality_score}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
