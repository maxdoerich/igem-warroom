import { useMemo, useState } from 'react';
import type { TeamSummary } from '../api';
import { fmtCompact, regionLabel, sectionLabel } from '../format';
import type { Filters } from './Leaderboard';

type Group = 'village' | 'country' | 'region' | 'section';

const GROUPS: { key: Group; label: string }[] = [
  { key: 'village', label: 'Track' },
  { key: 'country', label: 'Country' },
  { key: 'region', label: 'Region' },
  { key: 'section', label: 'Section' },
];

const keyOf = (t: TeamSummary, g: Group) => (g === 'section' ? (t.section ?? 'other') : t[g]) ?? '';
const labelOf = (g: Group, v: string) => (!v ? 'Unassigned' : g === 'region' ? regionLabel(v) : g === 'section' ? sectionLabel(v === 'other' ? null : v) : v);

/** Totals for the filtered teams, plus a per-group breakdown whose rows apply that group as a filter. */
export function Aggregates({ visible, filters, onFilters }: { visible: TeamSummary[]; filters: Filters; onFilters: (f: Filters) => void }) {
  const [group, setGroup] = useState<Group>('village');

  const sum = (ts: TeamSummary[]) => ({
    teams: ts.length,
    active: ts.filter((t) => t.c7d > 0).length,
    c7d: ts.reduce((a, t) => a + t.c7d, 0),
    parts: ts.reduce((a, t) => a + (t.registry?.published ?? 0), 0),
  });
  const total = useMemo(() => sum(visible), [visible]);
  const rows = useMemo(() => {
    const m = new Map<string, TeamSummary[]>();
    for (const t of visible) {
      const k = keyOf(t, group);
      (m.get(k) ?? m.set(k, []).get(k)!).push(t);
    }
    return [...m].map(([k, ts]) => ({ k, ...sum(ts) })).sort((a, b) => b.teams - a.teams);
  }, [visible, group]);

  return (
    <details className="aggr">
      <summary>
        <span className="mono">{total.teams}</span> teams · <span className="mono">{total.active}</span> active 7d ·{' '}
        <span className="mono">{fmtCompact(total.c7d)}</span> commits 7d · <span className="mono">{fmtCompact(total.parts)}</span> parts
      </summary>
      <div className="aggr-body">
        <div className="seg seg-inline">
          {GROUPS.map((g) => (
            <button key={g.key} className={group === g.key ? 'on' : ''} onClick={() => setGroup(g.key)}>
              {g.label.toUpperCase()}
            </button>
          ))}
        </div>
        <table className="tp-table">
          <thead>
            <tr>
              <th>{GROUPS.find((g) => g.key === group)!.label}</th>
              <th className="num" title="Teams">T</th>
              <th className="num" title="Active in last 7 days">Act</th>
              <th className="num" title="Commits in last 7 days">7d</th>
              <th className="num" title="Published parts">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.k}
                className={r.k && filters[group] === r.k ? 'clickable sel' : r.k ? 'clickable' : ''}
                onClick={() => r.k && onFilters({ ...filters, [group]: filters[group] === r.k ? '' : r.k })}
              >
                <td>{labelOf(group, r.k)}</td>
                <td className="num">{r.teams}</td>
                <td className="num">{r.active}</td>
                <td className="num">{fmtCompact(r.c7d)}</td>
                <td className="num">{fmtCompact(r.parts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
