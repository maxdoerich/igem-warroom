import { useEffect, useMemo, useState } from 'react';
import type { TeamSummary } from '../api';

export type ReplayOverride = Map<number, { heat: number; commits: number }>;

interface Activity {
  start: number;
  days: number;
  dayMs: number;
  series: Record<string, number[]>;
}

interface Props {
  teams: TeamSummary[];
  onOverride: (o: ReplayOverride | null) => void;
}

const DAYS = 120;
/** Same 48h decay as the server's live heat, applied per day. */
const DAILY_DECAY = Math.exp(-24 / 48);

/** Replays the last 120 days: marker heat and size as they were at the end of each day. */
export function Replay({ teams, onOverride }: Props) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [day, setDay] = useState(DAYS - 1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!open || activity) return;
    fetch(`/api/activity?days=${DAYS}`)
      .then((r) => r.json())
      .then((a: Activity) => {
        setActivity(a);
        setDay(0);
        setPlaying(true);
      })
      .catch(() => setOpen(false));
  }, [open, activity]);

  // Per team: heat and cumulative commits at the end of each day.
  const frames = useMemo(() => {
    if (!activity) return null;
    const out = new Map<number, { heat: Float32Array; cum: Int32Array }>();
    for (const t of teams) {
      const counts = activity.series[t.id] ?? [];
      const windowTotal = counts.reduce((a, b) => a + b, 0);
      let cum = Math.max(0, t.commits - windowTotal);
      let heat = 0;
      const h = new Float32Array(activity.days);
      const c = new Int32Array(activity.days);
      for (let d = 0; d < activity.days; d++) {
        const n = counts[d] ?? 0;
        heat = heat * DAILY_DECAY + n;
        cum += n;
        h[d] = heat;
        c[d] = cum;
      }
      out.set(t.id, { heat: h, cum: c });
    }
    return out;
  }, [activity, teams]);

  useEffect(() => {
    if (!open || !frames) {
      onOverride(null);
      return;
    }
    const o: ReplayOverride = new Map();
    for (const [id, f] of frames) o.set(id, { heat: f.heat[day], commits: f.cum[day] });
    onOverride(o);
  }, [open, frames, day, onOverride]);

  useEffect(() => {
    if (!playing || !activity) return;
    const id = setInterval(() => {
      setDay((d) => {
        if (d >= activity.days - 1) {
          setPlaying(false);
          return d;
        }
        return d + 1;
      });
    }, 140);
    return () => clearInterval(id);
  }, [playing, activity]);

  const close = () => {
    setOpen(false);
    setPlaying(false);
    setActivity(null);
  };

  if (!open) {
    return (
      <button className="replay-open btn" onClick={() => setOpen(true)}>
        ▶ Replay {DAYS} days
      </button>
    );
  }

  const date = activity ? new Date(activity.start + day * activity.dayMs).toISOString().slice(0, 10) : '…';
  const active = frames ? [...frames.values()].filter((f) => (f.heat[day] ?? 0) > 0.5).length : 0;

  return (
    <div className="replay panel">
      <button className="btn" onClick={() => (day >= DAYS - 1 && !playing ? (setDay(0), setPlaying(true)) : setPlaying(!playing))} disabled={!activity}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="replay-date mono">{date}</div>
      <input
        type="range"
        min={0}
        max={DAYS - 1}
        value={day}
        onChange={(e) => {
          setPlaying(false);
          setDay(Number(e.target.value));
        }}
        aria-label="Replay day"
      />
      <div className="replay-stat mono">
        {active} <span className="muted">hot teams</span>
      </div>
      <button className="btn" onClick={close}>
        Exit replay
      </button>
    </div>
  );
}
