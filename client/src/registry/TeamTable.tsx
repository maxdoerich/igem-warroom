import { useMemo, useState } from 'react';
import type { RegistryTeamRow } from '../api';
import { fmtAgo, regionLabel } from '../format';
import { StatusBar, StatusLegend } from './StatusBar';

export type RegMetric = 'published' | 'draft' | 'pipeline' | 'new7d';

const METRICS: { key: RegMetric; label: string; title: string }[] = [
  { key: 'published', label: 'PUBLISHED', title: 'Published parts (registry count)' },
  { key: 'draft', label: 'DRAFTS', title: 'Unpublished draft parts (registry count)' },
  { key: 'pipeline', label: 'PIPELINE', title: 'Drafts + in screening — work not yet public' },
  { key: 'new7d', label: 'NEW 7D', title: 'Published parts created in the last 7 days' },
];

export const metricValue = (t: RegistryTeamRow, m: RegMetric) =>
  m === 'pipeline' ? t.draft + t.screening : m === 'new7d' ? t.new7d : t[m];

interface Props {
  teams: RegistryTeamRow[];
  homeSlug: string;
  selectedId: number | null;
  onPick: (t: RegistryTeamRow) => void;
  now: number;
}

export function TeamTable({ teams, homeSlug, selectedId, onPick, now }: Props) {
  const [metric, setMetric] = useState<RegMetric>('published');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [withPartsOnly, setWithPartsOnly] = useState(true);

  const regions = useMemo(() => [...new Set(teams.map((t) => t.region).filter(Boolean) as string[])].sort(), [teams]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams
      .filter(
        (t) =>
          (!q || [t.name, t.country].some((v) => v?.toLowerCase().includes(q))) &&
          (!region || t.region === region) &&
          (!withPartsOnly || t.published + t.draft + t.screening > 0 || t.slug === homeSlug),
      )
      .sort((a, b) => metricValue(b, metric) - metricValue(a, metric) || b.published - a.published || a.name.localeCompare(b.name));
  }, [teams, query, region, withPartsOnly, metric, homeSlug]);

  const barMax = Math.max(1, ...visible.slice(0, 50).map((t) => t.published + t.screening + t.draft));
  const home = teams.find((t) => t.slug === homeSlug);
  const homeIdx = visible.findIndex((t) => t.slug === homeSlug);
  const pending = teams.filter((t) => t.found === null).length;

  return (
    <aside className="leaderboard panel">
      <div className="panel-title">
        <span>Team submissions</span>
        <span className="muted">
          {visible.length}/{teams.length}
        </span>
      </div>
      <div className="seg" role="tablist">
        {METRICS.map((m) => (
          <button key={m.key} role="tab" title={m.title} aria-selected={metric === m.key} className={metric === m.key ? 'on' : ''} onClick={() => setMetric(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="filters">
        <input type="search" placeholder="Search team or country…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {regionLabel(r)}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={withPartsOnly} onChange={(e) => setWithPartsOnly(e.target.checked)} />
          Only teams with parts
        </label>
        <StatusLegend />
        {pending > 0 && <div className="note">Counts pending for {pending} teams…</div>}
      </div>

      {home && (
        <button className={`lb-home ${selectedId === home.id ? 'sel' : ''}`} onClick={() => onPick(home)}>
          <span className="lb-home-tag">HOME</span>
          <span className="lb-name">{home.name}</span>
          <span className="lb-home-rank">{homeIdx >= 0 && metricValue(home, metric) > 0 ? `#${homeIdx + 1}` : '—'}</span>
          <span className="lb-val">{home.found === null ? '…' : metricValue(home, metric)}</span>
        </button>
      )}

      <div className="rt-head">
        <span />
        <span>Team</span>
        <span className="num" title="Published">Pub</span>
        <span className="num" title="Drafts">Draft</span>
      </div>
      <ol className="lb-list">
        {visible.map((t, i) => (
          <li key={t.id}>
            <button
              className={`rt-row ${t.slug === homeSlug ? 'home' : ''} ${selectedId === t.id ? 'sel' : ''}`}
              onClick={() => onPick(t)}
              title={t.lastPartAt ? `Newest published part created ${fmtAgo(t.lastPartAt, now)}` : undefined}
            >
              <span className="lb-rank">{metricValue(t, metric) > 0 ? i + 1 : '—'}</span>
              <span className="lb-main">
                <span className="lb-name">{t.name}</span>
                <StatusBar published={t.published} screening={t.screening} draft={t.draft} max={barMax} width={150} height={6} />
              </span>
              <span className="num v-published">{t.found === null ? '…' : t.published}</span>
              <span className="num v-draft">{t.found === null ? '' : t.draft}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
