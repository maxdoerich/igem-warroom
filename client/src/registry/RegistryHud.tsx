import type { RegistryOverview } from '../api';
import { fmtAgo, fmtInt } from '../format';

export function RegistryHud({ overview, connected, now, onOpenMap }: { overview: RegistryOverview | null; connected: boolean; now: number; onOpenMap: () => void }) {
  const t = overview?.totals;
  const p = overview?.parts;
  return (
    <header className="hud">
      <div className="hud-brand">
        <svg width="20" height="20" viewBox="-10 -10 20 20" aria-hidden>
          <rect x="-7" y="-7" width="14" height="14" rx="2" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
          <path d="M-7 -1h14M-1 -7v14" stroke="var(--accent)" strokeWidth="1.5" />
        </svg>
        <span>
          PARTS REGISTRY <span className="muted">// 2026</span>
        </span>
      </div>
      <Cell label="Published parts" value={t ? fmtInt(t.published) : '—'} cls="v-published" />
      <Cell label="In screening" value={t ? fmtInt(t.screening) : '—'} cls="v-screening" />
      <Cell label="Drafts" value={t ? fmtInt(t.draft) : '—'} cls="v-draft" />
      <Cell label="Created 24h / 7d" value={p ? `${p.created24h} / ${p.created7d}` : '—'} />
      <Cell label="Teams publishing" value={t ? `${t.teamsPublishing}` : '—'} sub={t ? `/${t.teams}` : ''} />
      <div className="hud-spacer" />
      {overview && <SyncCell overview={overview} now={now} />}
      <button className="hud-link" onClick={onOpenMap} title="Focus the map window">
        ◱ Map
      </button>
      <div className={`hud-live ${connected ? 'on' : 'off'}`}>
        <span className="dot" />
        {connected ? 'LIVE' : 'OFFLINE'}
      </div>
    </header>
  );
}

function Cell({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="hud-cell">
      <span className="hud-label">{label}</span>
      <span className={`hud-value ${cls ?? ''}`}>
        {value}
        {sub && <span className="muted">{sub}</span>}
      </span>
    </div>
  );
}

function SyncCell({ overview, now }: { overview: RegistryOverview; now: number }) {
  const { totals, parts, status, budget } = overview;
  const loading = totals.summarised < totals.teams || parts.attributed < parts.listed;
  const waiting = budget.waitingUntil && budget.waitingUntil > now;
  let state: { cls: string; icon: string; text: string };
  if (status.lastError) state = { cls: 'bad', icon: '■', text: 'Sync error' };
  else if (loading)
    state = {
      cls: 'warn',
      icon: '▲',
      text: `Counts ${totals.summarised}/${totals.teams} · teams for parts ${parts.attributed}/${parts.listed}${waiting ? ` · paused ${Math.ceil((budget.waitingUntil! - now) / 60_000)}m` : ''}`,
    };
  else state = { cls: 'good', icon: '●', text: `Checked ${fmtAgo(status.lastLiveAt, now)}` };
  return (
    <div className="hud-cell hud-sync" title={status.lastError ?? ''}>
      <span className="hud-label">
        Sync · registry API{budget.windows.large.remaining !== null && ` · ${budget.windows.large.remaining} req left`}
      </span>
      <span className={`hud-value status-${state.cls}`}>
        <span className="status-icon" aria-hidden>
          {state.icon}
        </span>{' '}
        {state.text}
      </span>
    </div>
  );
}
