# Smart Greenhouse Monitoring Dashboard

Real-time greenhouse sensor monitoring built with **Next.js**, **Supabase** (PostgreSQL + Realtime), and **Recharts**. Designed as a portfolio project demonstrating time-series database design, real-time data pipelines, and interactive dashboards.

**Live Demo:** [smart-gh-iot.vercel.app](https://smart-gh-iot.vercel.app)

![Dark Theme Dashboard](https://img.shields.io/badge/theme-dark-gray?style=flat-square) ![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square) ![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square)

---

## Features

- **Real-time monitoring** — Live sensor data via Supabase Realtime (WebSocket)
- **Multi-zone dashboard** — Monitor temperature & humidity across 5 greenhouse zones
- **Interactive charts** — Zone comparison, temperature/humidity detail, hourly min/avg/max
- **Smart alerts** — Auto-detect threshold breaches with deduplication and auto-resolve
- **Time range selector** — Switch between 1h / 6h / 24h / 7d views
- **Sensor simulator** — Python tool with normal, burst, and stress test modes

---

## Architecture

```
┌──────────────┐     INSERT      ┌──────────────────┐
│  Simulator    │ ──────────────> │  sensor_readings  │
│  (Python)     │                 │  (time-series)    │
└──────────────┘                 └────────┬──────────┘
                                          │ Triggers (statement-level)
                                 ┌────────┼────────────┐
                                 ▼        ▼            ▼
                          ┌─────────┐ ┌──────────┐ ┌────────┐
                          │ latest  │ │  hourly   │ │ events │
                          │ (cache) │ │ (agg)     │ │(alerts)│
                          └────┬────┘ └─────┬────┘ └───┬────┘
                               │            │          │
                          ┌────▼────────────▼──────────▼───┐
                          │     Views (latest_readings,     │
                          │     active_alerts, hourly_summ) │
                          └────────────┬───────────────────┘
                                       │ Supabase Realtime
                          ┌────────────▼───────────────────┐
                          │       Next.js Dashboard         │
                          │  (React hooks + Recharts)       │
                          └────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| Charts | Recharts 3 |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL (Supabase) |
| Realtime | Supabase Realtime (WAL → WebSocket) |
| Simulator | Python 3, Supabase Client |

---

## Project Structure

```
├── src/                        # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Main dashboard page
│   │   │   ├── layout.tsx      # Root layout
│   │   │   └── globals.css     # Global styles
│   │   ├── components/
│   │   │   ├── StatsBar.tsx          # Overview cards
│   │   │   ├── SensorCard.tsx        # Sensor list item
│   │   │   ├── AlertBanner.tsx       # Alert notification
│   │   │   ├── ZoneComparisonChart.tsx
│   │   │   ├── SensorDetailCharts.tsx
│   │   │   ├── SensorStatsPanel.tsx
│   │   │   ├── LatestReadingsTable.tsx
│   │   │   └── TimeRangeSelector.tsx
│   │   └── lib/
│   │       ├── supabase.ts     # Client + TypeScript types
│   │       └── useRealtime.ts  # Realtime hooks (4 hooks)
│   └── .env.local              # Supabase credentials
├── supabase/
│   ├── schema.sql              # Full database schema
│   ├── seed.sql                # Sample data (5 sensors, 24h history)
│   └── migrations/             # Supabase CLI migrations
├── simulator/
│   ├── sensor_simulator.py     # 3-mode sensor simulator
│   └── requirements.txt
├── schema/                     # Standalone PostgreSQL schema (reference)
└── docs/                       # Technical documentation
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+ (for simulator)
- [Supabase account](https://supabase.com) (free tier works)

### 1. Create Supabase Project

Create a new project at [supabase.com](https://supabase.com), then run the schema and seed:

1. Go to **SQL Editor** in your Supabase dashboard
2. Paste the contents of `supabase/schema.sql` and run it
3. Paste the contents of `supabase/seed.sql` and run it

This creates 5 sample sensors and 24 hours of historical data.

### 2. Configure Frontend

```bash
cd src

# Install dependencies
npm install

# Create .env.local with your Supabase credentials
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the dashboard with sensor data.

### 3. Run the Simulator (Optional)

Feed live data into the dashboard:

```bash
cd simulator

# Install Python dependency
pip install -r requirements.txt

# Set environment variables
export SUPABASE_URL=https://your-project-id.supabase.co
export SUPABASE_KEY=your-anon-key

# Normal mode: 1 reading per sensor every 5 seconds
python sensor_simulator.py

# Burst mode: 50 readings per sensor every second
python sensor_simulator.py --mode burst --batch-size 50 --interval 1

# Stress test: max throughput
python sensor_simulator.py --mode stress --batch-size 100
```

The dashboard updates in real-time as data flows in — no refresh needed.

---

## Database Design

### Tables

| Table | Purpose | Rows |
|-------|---------|------|
| `sensors` | Sensor devices with thresholds | ~5 |
| `sensor_readings` | Raw time-series data (main table) | Millions |
| `sensor_latest` | Cache: 1 row per sensor (trigger-maintained) | 5 |
| `sensor_readings_hourly` | Hourly aggregations (trigger-maintained) | ~120/day |
| `events` | Threshold alerts with dedup | Low volume |

### Key Optimizations

- **`REAL` instead of `NUMERIC`** — 4-byte float for faster inserts, sufficient precision for sensor data
- **BRIN indexes** — ~128KB per 1M rows vs ~30MB for B-tree on time-series data
- **Statement-level triggers** — Batch INSERT of 100 rows fires trigger once, not 100 times
- **`FILLFACTOR = 90`** — HOT updates on frequently-updated cache tables
- **Set-based event detection** — No PL/pgSQL loops, pure SQL with CTEs

### Realtime Strategy

| What | Subscribe to | Why |
|------|-------------|-----|
| Sensor cards | `sensor_latest` UPDATE | 1 event per sensor, not per reading |
| Chart data | `sensor_readings` INSERT | Filtered per sensor, throttled 500ms |
| Alerts | `events` INSERT/UPDATE | Low volume, fires on threshold breach |

---

## Dashboard Guide

| Section | Description |
|---------|-------------|
| **Stats Bar** | Active sensors, alert count, avg temp/humidity with range |
| **Alert Banner** | Color-coded alerts with dismiss (auto-resolves when readings normalize) |
| **Zone Comparison** | Multi-line chart comparing temperature across all zones |
| **Sensor Cards** | Click to select — shows current values and threshold status |
| **Detail Panel** | Stats, temperature chart, humidity chart, hourly range, thresholds, readings table |
| **Time Range** | Switch between 1h / 6h / 24h / 7d views |

---

## Deployment

### Frontend (Vercel)

```bash
# Push to GitHub, then connect repo at vercel.com
# Add environment variables in Vercel dashboard:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Database (Supabase)

Already hosted — no additional deployment needed.

---

## License

MIT
