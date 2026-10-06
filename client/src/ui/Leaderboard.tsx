import { useMemo } from 'react';
import type { TeamSummary } from '../api';
import { fmtAgo, fmtCompact, regionLabel, sectionLabel } from '../format';
import { Aggregates } from './Aggregates';
import { Sparkline } from './Sparkline';

export type Metric = 'c24h' | 'c7d' | 'commits' | 'heat' | 'parts' | 'streak' | 'growth' | 'lines';

export interface Filters {
  query: string;
  region: string;
  section: string;
  village: string;
  country: string;
  activeOnly: boolean;
}

const METRICS: { key: Metric; label: string; title: string }[] = [
  { key: 'c24h', label: '24H', title: 'Commits in the last 24 hours' },
  { key: 'c7d', label: '7D', title: 'Commits in the last 7 days' },
  { key: 'commits', label: 'TOTAL', title: 'All commits' },
  { key: 'heat', label: 'HEAT', title: 'Recency-weighted activity' },
  { key: 'parts', label: 'PARTS', title: 'Published registry parts' },
  { key: 'streak', label: 'STREAK', title: 'Consecutive days with a commit' },
  { key: 'growth', label: 'Δ7D', title: 'Commits in the last 7 days minus the 7 days before — fastest-growing first' },
  { key: 'lines', label: 'LINES', title: 'Net lines added to the wiki repo (additions − deletions)' },
];

export const metricValue = (t: TeamSummary, m: Metric): number => {
  switch (m) {
    case 'parts':
      return t.registry?.published ?? 0;
    case 'growth':
      return t.c7d - t.cPrev7d;
    case 'lines':
      return t.additions - t.deletions;
    default:
      return t[m];
  }
};

function fmtMetric(t: TeamSummary, m: Metric): string {
  const v = metricValue(t, m);
  if (m === 'heat') return v.toFixed(1);
  if (m === 'streak') return `${v}d`;
  if (m === 'growth') return v > 0 ? `+${fmtCompact(v)}` : String(v);
  return fmtCompact(v);
}

interface Props {
  teams: TeamSummary[];
  visible: TeamSummary[];
  metric: Metric;
  onMetric: (m: Metric) => void;
  filters: Filters;
  onFilters: (f: Filters) => void;
  homeSlug: string;
  selectedId: number | null;
  onPick: (t: TeamSummary) => void;
  now: number;
}

export function Leaderboard({ teams, visible, metric, onMetric, filters, onFilters, homeSlug, selectedId, onPick, now }: Props) {
  const regions = useMemo(() => [...new Set(teams.map((t) => t.region).filter(Boolean) as string[])].sort(), [teams]);
  const sections = useMemo(() => [...new Set(teams.map((t) => t.section ?? 'other'))].sort(), [teams]);

  const countries = useMemo(() => [...new Set(teams.map((t) => t.country).filter(Boolean) as string[])].sort(), [teams]);
  const villages = useMemo(() => [...new Set(teams.map((t) => t.village).filter(Boolean) as string[])].sort(), [teams]);

  const ranked = useMemo(
    () => [...visible].sort((a, b) => metricValue(b, metric) - metricValue(a, metric) || (b.lastCommitAt ?? 0) - (a.lastCommitAt ?? 0)),
    [visible, metric],
  );
  const sparkMax = useMemo(() => Math.max(1, ...ranked.slice(0, 60).flatMap((t) => t.spark)), [ranked]);
  const home = teams.find((t) => t.slug === homeSlug);
  const homeIdx = ranked.findIndex((t) => t.slug === homeSlug);

  const fmtValue = (t: TeamSummary) => fmtMetric(t, metric);

  return (
    <aside className="leaderboard panel">
      <div className="panel-title">
        <span>Leaderboard</span>
        <span className="muted">
          {visible.length}/{teams.length} teams
        </span>
      </div>

      <div className="seg" role="tablist">
        {METRICS.map((m) => (
          <button key={m.key} role="tab" title={m.title} aria-selected={metric === m.key} className={metric === m.key ? 'on' : ''} onClick={() => onMetric(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Search team, city, country…"
          value={filters.query}
          onChange={(e) => onFilters({ ...filters, query: e.target.value })}
        />
        <div className="filter-row">
          <select value={filters.region} onChange={(e) => onFilters({ ...filters, region: e.target.value })}>
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {regionLabel(r)}
              </option>
            ))}
          </select>
          <select value={filters.section} onChange={(e) => onFilters({ ...filters, section: e.target.value })}>
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {sectionLabel(s === 'other' ? null : s)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-row">
          <select value={filters.village} onChange={(e) => onFilters({ ...filters, village: e.target.value })}>
            <option value="">All tracks</option>
            {villages.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select value={filters.country} onChange={(e) => onFilters({ ...filters, country: e.target.value })}>
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={filters.activeOnly} onChange={(e) => onFilters({ ...filters, activeOnly: e.target.checked })} />
          Active in last 7 days only
        </label>
      </div>

      <Aggregates visible={visible} filters={filters} onFilters={onFilters} />

      {home && (
        <button className={`lb-home ${selectedId === home.id ? 'sel' : ''}`} onClick={() => onPick(home)}>
          <span className="lb-home-tag">HOME</span>
          <span className="lb-name">{home.name}</span>
          <span className="lb-home-rank">{homeIdx >= 0 && metricValue(home, metric) > 0 ? `#${homeIdx + 1}` : '—'}</span>
          <span className="lb-val">{fmtValue(home)}</span>
        </button>
      )}

      <ol className="lb-list">
        {ranked.map((t, i) => (
          <li key={t.id}>
            <button
              className={`lb-row ${t.slug === homeSlug ? 'home' : ''} ${selectedId === t.id ? 'sel' : ''}`}
              onClick={() => onPick(t)}
              title={`${t.name} — last commit ${fmtAgo(t.lastCommitAt, now)}`}
            >
              <span className="lb-rank">{metricValue(t, metric) > 0 ? i + 1 : '—'}</span>
              <span className="lb-main">
                <span className="lb-name">{t.name}</span>
                <span className="lb-sub">
                  {t.country} · {fmtAgo(t.lastCommitAt, now)}
                </span>
              </span>
              <Sparkline values={t.spark} max={sparkMax} width={56} height={16} />
              <span className="lb-val">{t.gitlabPath ? fmtValue(t) : '—'}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
