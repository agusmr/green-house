'use client';

const RANGES = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
] as const;

export default function TimeRangeSelector({ value, onChangeAction }: {
  value: number;
  onChangeAction: (hours: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
      {RANGES.map(r => (
        <button
          key={r.hours}
          onClick={() => onChangeAction(r.hours)}
          className={`px-3 py-1 text-xs rounded-md transition-all ${
            value === r.hours
              ? 'bg-emerald-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export type TimeRange = typeof RANGES;
