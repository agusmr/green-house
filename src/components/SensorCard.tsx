'use client';

import { Thermometer, Droplets, MapPin, Wifi } from 'lucide-react';
import type { SensorLatest } from '@/lib/supabase';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function getTempStatus(temp: number | null, high: number | null, low: number | null) {
  if (temp === null || high === null || low === null) return 'normal';
  if (temp > high) return 'danger';
  if (temp < low) return 'warning';
  return 'normal';
}

function getHumidityStatus(humidity: number | null, high: number | null, low: number | null) {
  if (humidity === null || high === null || low === null) return 'normal';
  if (humidity > high) return 'danger';
  if (humidity < low) return 'warning';
  return 'normal';
}

const statusColors = {
  normal: 'text-green-400',
  warning: 'text-yellow-400',
  danger: 'text-red-400',
};

const bgColors = {
  normal: 'border-green-900/30',
  warning: 'border-yellow-900/30',
  danger: 'border-red-900/30',
};

export default function SensorCard({ sensor, onClickAction, isSelected }: {
  sensor: SensorLatest;
  onClickAction: () => void;
  isSelected: boolean;
}) {
  const tempStatus = getTempStatus(sensor.temperature, sensor.threshold_temp_high, sensor.threshold_temp_low);
  const humStatus = getHumidityStatus(sensor.humidity, sensor.threshold_humidity_high, sensor.threshold_humidity_low);
  const worstStatus = tempStatus === 'danger' || humStatus === 'danger' ? 'danger'
    : tempStatus === 'warning' || humStatus === 'warning' ? 'warning' : 'normal';

  return (
    <button
      onClick={onClickAction}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? 'border-emerald-500 bg-emerald-950/20'
          : `bg-gray-900 ${bgColors[worstStatus]} hover:border-gray-600`
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white">{sensor.name}</h3>
        <Wifi className="w-4 h-4 text-green-400" />
      </div>

      {sensor.location && (
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
          <MapPin className="w-3 h-3" />
          {sensor.location}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <Thermometer className={`w-4 h-4 ${statusColors[tempStatus]}`} />
          <div>
            <div className={`text-lg font-mono ${statusColors[tempStatus]}`}>
              {sensor.temperature !== null ? `${sensor.temperature}°` : '--'}
            </div>
            <div className="text-[10px] text-gray-500">Temperature</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Droplets className={`w-4 h-4 ${statusColors[humStatus]}`} />
          <div>
            <div className={`text-lg font-mono ${statusColors[humStatus]}`}>
              {sensor.humidity !== null ? `${sensor.humidity}%` : '--'}
            </div>
            <div className="text-[10px] text-gray-500">Humidity</div>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-gray-600">
        Updated {timeAgo(sensor.recorded_at)} &middot; {formatTime(sensor.recorded_at)}
      </div>
    </button>
  );
}
