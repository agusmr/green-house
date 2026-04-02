'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useLatestReadings, useSensorHistory, useActiveAlerts, useHourlySummary } from '@/lib/useRealtime';
import { supabase } from '@/lib/supabase';
import StatsBar from '@/components/StatsBar';
import SensorCard from '@/components/SensorCard';
import AlertBanner from '@/components/AlertBanner';
import ZoneComparisonChart from '@/components/ZoneComparisonChart';
import { TemperatureDetailChart, HumidityDetailChart, HourlyRangeChart } from '@/components/SensorDetailCharts';
import SensorStatsPanel from '@/components/SensorStatsPanel';
import LatestReadingsTable from '@/components/LatestReadingsTable';
import TimeRangeSelector from '@/components/TimeRangeSelector';
import { Leaf, Activity } from 'lucide-react';

export default function Dashboard() {
  const [selectedSensor, setSelectedSensor] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState(24);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(new Set());

  const { data: latest, loading: latestLoading } = useLatestReadings();
  const { data: history, loading: historyLoading } = useSensorHistory(selectedSensor, timeRange);
  const { data: hourly } = useHourlySummary(selectedSensor, timeRange);
  const { alerts } = useActiveAlerts();

  // Auto-select first sensor on initial load
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (!hasAutoSelected.current && latest.length > 0) {
      setSelectedSensor(latest[0].sensor_id);
      hasAutoSelected.current = true;
    }
  }, [latest]);

  const selected = latest.find(s => s.sensor_id === selectedSensor);

  // Filter out dismissed alerts
  const visibleAlerts = useMemo(
    () => alerts.filter(a => !dismissedAlerts.has(a.id)),
    [alerts, dismissedAlerts]
  );

  // All-sensor history for zone comparison chart
  // Only refetch when sensor IDs change (not on every value update)
  const [allHistoryMap, setAllHistoryMap] = useState<Record<number, { recorded_at: string; temperature: number | null }[]>>({});
  const fetchedSensorIdsRef = useRef<string>('');

  useEffect(() => {
    if (latest.length === 0) return;

    const sensorIds = latest.map(s => s.sensor_id).sort().join(',');
    if (sensorIds === fetchedSensorIdsRef.current) return;
    fetchedSensorIdsRef.current = sensorIds;

    const since = new Date(Date.now() - 24 * 3600000).toISOString();

    const promises = latest.map(async (s) => {
      const { data: rows } = await supabase
        .from('sensor_readings')
        .select('recorded_at, temperature')
        .eq('sensor_id', s.sensor_id)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true });
      return {
        sensor_id: s.sensor_id,
        readings: (rows || []) as { recorded_at: string; temperature: number | null }[],
      };
    });

    Promise.all(promises).then(results => {
      const map: Record<number, { recorded_at: string; temperature: number | null }[]> = {};
      for (const r of results) {
        map[r.sensor_id] = r.readings;
      }
      setAllHistoryMap(map);
    });
  }, [latest]);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Leaf className="w-6 h-6 text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Smart Greenhouse</h1>
              <p className="text-xs text-gray-500">Real-time Monitoring Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <TimeRangeSelector value={timeRange} onChangeAction={setTimeRange} />
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-xs text-gray-400">
                {latest.length} sensor{latest.length !== 1 ? 's' : ''} online
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Stats Overview */}
        <StatsBar sensors={latest} alerts={alerts} />

        {/* Active Alerts */}
        {visibleAlerts.length > 0 && (
          <AlertBanner
            alerts={visibleAlerts}
            onCloseAction={(id: number) => setDismissedAlerts(prev => new Set(prev).add(id))}
          />
        )}

        {/* Zone Comparison Chart */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Zone Temperature Comparison (24h)</h2>
          <ZoneComparisonChart sensors={latest} historyMap={allHistoryMap} />
        </div>

        {/* Sensor Detail Area */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar: Sensor Cards */}
          <aside className="lg:w-72 shrink-0 space-y-2">
            <h2 className="text-sm font-medium text-gray-400 mb-2">Sensors</h2>
            {latestLoading ? (
              <div className="text-gray-500 text-sm">Loading...</div>
            ) : (
              latest.map(sensor => (
                <SensorCard
                  key={sensor.sensor_id}
                  sensor={sensor}
                  isSelected={selectedSensor === sensor.sensor_id}
                  onClickAction={() => setSelectedSensor(sensor.sensor_id)}
                />
              ))
            )}
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 space-y-4">
            {selectedSensor && selected ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
                    {selected.location && <p className="text-sm text-gray-400">{selected.location}</p>}
                  </div>
                  <div className="text-xs text-gray-500">{history.length} readings in range</div>
                </div>

                <SensorStatsPanel sensor={selected} hourly={hourly} timeRange={timeRange} />

                {/* Temperature Chart */}
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Temperature</h3>
                  {historyLoading ? (
                    <div className="flex items-center justify-center h-48 text-gray-500">Loading...</div>
                  ) : (
                    <TemperatureDetailChart history={history} />
                  )}
                </div>

                {/* Humidity Chart */}
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Humidity</h3>
                  {historyLoading ? (
                    <div className="flex items-center justify-center h-48 text-gray-500">Loading...</div>
                  ) : (
                    <HumidityDetailChart history={history} />
                  )}
                </div>

                {/* Hourly Range Chart */}
                {hourly.length > 0 && (
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Hourly Temperature Range (Min / Avg / Max)</h3>
                    <HourlyRangeChart hourly={hourly} />
                  </div>
                )}

                {/* Thresholds */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 text-center">
                    <div className="text-xs text-gray-500">Temp High Alert</div>
                    <div className="text-lg font-mono text-red-400">{selected.threshold_temp_high ?? '--'}°</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 text-center">
                    <div className="text-xs text-gray-500">Temp Low Alert</div>
                    <div className="text-lg font-mono text-blue-400">{selected.threshold_temp_low ?? '--'}°</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 text-center">
                    <div className="text-xs text-gray-500">Humidity High</div>
                    <div className="text-lg font-mono text-orange-400">{selected.threshold_humidity_high ?? '--'}%</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 text-center">
                    <div className="text-xs text-gray-500">Humidity Low</div>
                    <div className="text-lg font-mono text-yellow-400">{selected.threshold_humidity_low ?? '--'}%</div>
                  </div>
                </div>

                {/* Readings Table */}
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Readings</h3>
                  <LatestReadingsTable
                    data={history}
                    tempHigh={selected.threshold_temp_high}
                    tempLow={selected.threshold_temp_low}
                    humHigh={selected.threshold_humidity_high}
                    humLow={selected.threshold_humidity_low}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-96 text-gray-500">
                <div className="text-center">
                  <Leaf className="w-12 h-12 mx-auto mb-4 text-gray-700" />
                  <p>Select a sensor to view detailed data</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
