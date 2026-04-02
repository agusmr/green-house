'use client';

import { AlertTriangle, X } from 'lucide-react';
import type { ActiveAlert } from '@/lib/supabase';

const eventLabels: Record<string, string> = {
  high_temp: 'HIGH TEMPERATURE',
  low_temp: 'LOW TEMPERATURE',
  high_humidity: 'HIGH HUMIDITY',
  low_humidity: 'LOW HUMIDITY',
  sensor_offline: 'SENSOR OFFLINE',
};

const eventColors: Record<string, string> = {
  high_temp: 'bg-red-900/60 border-red-700',
  low_temp: 'bg-blue-900/60 border-blue-700',
  high_humidity: 'bg-orange-900/60 border-orange-700',
  low_humidity: 'bg-yellow-900/60 border-yellow-700',
  sensor_offline: 'bg-gray-800 border-gray-600',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function AlertBanner({ alerts, onCloseAction }: {
  alerts: ActiveAlert[];
  onCloseAction: (id: number) => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`flex items-center justify-between p-3 rounded-lg border ${eventColors[alert.event_type] || 'bg-gray-800 border-gray-600'}`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-white shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  {eventLabels[alert.event_type] || alert.event_type}
                </span>
                <span className="text-gray-300 text-xs">
                  {alert.sensor_name} {alert.location && `(${alert.location})`}
                </span>
              </div>
              <div className="text-xs text-gray-300">
                Value: {alert.value} &middot; Threshold: {alert.threshold} &middot; {timeAgo(alert.created_at)}
              </div>
            </div>
          </div>
          <button onClick={() => onCloseAction(alert.id)} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
