import { useMemo, useState } from 'react';
import type { RegistryPartListItem } from '../api';
import { fmtInt } from '../format';

/** Usage count at which a part is flagged popular (the registry's max is ~16, so this is roughly the top few %). */
const POPULAR = 5;
const MAX_ROWS = 300;

type Sort = 'usage' | 'newest' | 'length';
type Mode = 'list' | 'type';

const normTitle = (t: string | null) => (t ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export function PartsExplorer({ parts, onPickTeam }: { parts: RegistryPartListItem[]; onPickTeam: (id: number) => void }) {
  const [mode, setMode] = useState<Mode>('type');
  const [role, setRole] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('usage');
  const [flagged, setFlagged] = useState<'' | 'popular' | 'dup' | 'shared'>('');

  // Possible duplicates: different parts whose titles normalise to the same string.
  const dupSize = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of parts) {
      const k = normTitle(p.title);
      if (k.length >= 4) n.set(k, (n.get(k) ?? 0) + 1);
    }
    return (p: RegistryPartListItem) => {
      const c = n.get(normTitle(p.title)) ?? 0;
      return c > 1 ? c : 0;
    };
  }, [parts]);

  const types = useMemo(() => {
    const m = new Map<string, { label: string; n: number; uses: number; teams: Set<number>; top: RegistryPartListItem }>();
    for (const p of parts) {
      const label = p.role ?? 'Unspecified';
      const g = m.get(label) ?? { label, n: 0, uses: 0, teams: new Set<number>(), top: p };
      g.n++;
      g.uses += p.usageCount;
      p.teams.forEach((t) => g.teams.add(t.id));
      if (p.usageCount > g.top.usageCount) g.top = p;
      m.set(label, g);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [parts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts
      .filter(
        (p) =>
          (!role || (p.role ?? 'Unspecified') === role) &&
          (!q || p.name.toLowerCase().includes(q) || p.title?.toLowerCase().includes(q) || p.teams.some((t) => t.name.toLowerCase().includes(q))) &&
          (flagged === '' ||
            (flagged === 'popular' && p.usageCount >= POPULAR) ||
            (flagged === 'dup' && dupSize(p) > 0) ||
            (flagged === 'shared' && p.teamCount > 1)),
      )
      .sort((a, b) =>
        sort === 'usage' ? b.usageCount - a.usageCount || b.createdAt - a.createdAt : sort === 'newest' ? b.createdAt - a.createdAt : (b.seqLength ?? 0) - (a.seqLength ?? 0),
      );
  }, [parts, role, query, sort, flagged, dupSize]);

  const typeMax = Math.max(1, ...types.map((t) => t.n));
  const dupParts = useMemo(() => parts.filter((p) => dupSize(p) > 0).length, [parts, dupSize]);
  const popularParts = useMemo(() => parts.filter((p) => p.usageCount >= POPULAR).length, [parts]);

  return (
    <div className="reg-overview">
      <section className="panel reg-card reg-wide">
        <div className="panel-title">
          <span>Parts explorer · published parts</span>
          <span className="muted">
            {fmtInt(parts.length)} parts · {types.length} types · {popularParts} popular · {dupParts} possible duplicates
          </span>
        </div>
        <div className="reg-card-body">
          <div className="seg seg-inline pe-seg">
            <button className={mode === 'type' ? 'on' : ''} onClick={() => setMode('type')}>
              BY TYPE
            </button>
            <button className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>
              ALL PARTS
            </button>
          </div>

          {mode === 'type' ? (
            <table className="tp-table backlog">
              <thead>
                <tr>
                  <th>Type</th>
                  <th />
                  <th className="num">Parts</th>
                  <th className="num">Teams</th>
                  <th className="num" title="Sum of the registry's usage counts">Uses</th>
                  <th>Most used</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr
                    key={t.label}
                    className="clickable"
                    onClick={() => {
                      setRole(t.label);
                      setMode('list');
                    }}
                  >
                    <td>{t.label}</td>
                    <td style={{ width: '30%' }}>
                      <span className="hbar-track">
                        <span className="hbar-fill" style={{ width: `${(t.n / typeMax) * 100}%` }} />
                      </span>
                    </td>
                    <td className="num">{fmtInt(t.n)}</td>
                    <td className="num">{t.teams.size}</td>
                    <td className="num">{t.uses}</td>
                    <td className="mono">
                      {t.top.usageCount > 0 ? (
                        <a href={t.top.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          {t.top.name}
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <>
              <div className="pe-filters">
                <input type="search" placeholder="Search part, title or team…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">All types</option>
                  {types.map((t) => (
                    <option key={t.label} value={t.label}>
                      {t.label} ({t.n})
                    </option>
                  ))}
                </select>
                <select value={flagged} onChange={(e) => setFlagged(e.target.value as typeof flagged)}>
                  <option value="">All parts</option>
                  <option value="popular">★ Popular (≥{POPULAR} uses)</option>
                  <option value="dup">⚑ Possible duplicates</option>
                  <option value="shared">Shared by several teams</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="usage">Most used</option>
                  <option value="newest">Newest</option>
                  <option value="length">Longest</option>
                </select>
              </div>
              <div className="reg-table-wrap">
                <table className="tp-table parts-table">
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th>Type</th>
                      <th className="num">bp</th>
                      <th className="num">Uses</th>
                      <th>Teams</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, MAX_ROWS).map((p) => {
                      const dup = dupSize(p);
                      return (
                        <tr key={p.uuid}>
                          <td>
                            <a className="mono" href={p.url} target="_blank" rel="noreferrer">
                              {p.name}
                            </a>
                            {p.usageCount >= POPULAR && <span className="tag tag-warn" title={`Used ${p.usageCount} times`}>★</span>}
                            {dup > 0 && (
                              <span className="tag tag-dim" title={`${dup} parts share this title`}>
                                ⚑ ×{dup}
                              </span>
                            )}
                            <div className="part-title">{p.title}</div>
                          </td>
                          <td className="muted">{p.role ?? '—'}</td>
                          <td className="num">{p.seqLength ? fmtInt(p.seqLength) : '—'}</td>
                          <td className="num">{p.usageCount}</td>
                          <td>
                            {p.teams.map((t) => (
                              <button key={t.id} className="team-chip" onClick={() => onPickTeam(t.id)}>
                                {t.name}
                              </button>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="caption">
                {rows.length > MAX_ROWS ? `Showing ${MAX_ROWS} of ${fmtInt(rows.length)} — narrow the filters. ` : `${rows.length} parts. `}
                Duplicates are parts whose titles match ignoring case and punctuation; the registry exposes no sequence hash.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
