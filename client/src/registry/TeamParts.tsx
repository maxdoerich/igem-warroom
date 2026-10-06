import { useMemo, useState } from 'react';
import { api, type RegistryTeamDetail } from '../api';
import { fmtAgo, fmtInt, fmtUtc, regionLabel, sectionLabel } from '../format';
import { HBars } from './Overview';
import { StatusBar, StatusLegend } from './StatusBar';

type SortKey = 'createdAt' | 'name' | 'role' | 'seqLength' | 'usageCount';

export function TeamParts({ team, isHome, onClose, onShowOnMap, now, onDetail }: { team: RegistryTeamDetail; isHome: boolean; onClose: () => void; onShowOnMap: () => void; now: number; onDetail: (d: RegistryTeamDetail) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'createdAt', dir: -1 });
  const parts = useMemo(() => {
    const val = (p: (typeof team.parts)[number]) => p[sort.key] ?? '';
    return [...team.parts].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [team.parts, sort]);
  const th = (key: SortKey, label: string, num = false) => (
    <th className={num ? 'num' : ''}>
      <button className="th-sort" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : key === 'name' || key === 'role' ? 1 : -1 }))}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );
  const [syncing, setSyncing] = useState<'idle' | 'busy' | 'error'>('idle');
  const syncDrafts = () => {
    setSyncing('busy');
    api.syncRegistryDrafts(team.id).then(
      (d) => {
        onDetail(d);
        setSyncing('idle');
      },
      () => setSyncing('error'),
    );
  };
  const total = team.published + team.screening + team.draft;

  return (
    <div className="reg-team">
      <section className="panel reg-card reg-wide">
        <div className="panel-title">
          <span>
            {isHome && <span className="tag tag-accent">HOME</span>} Registry dossier
          </span>
          <span>
            <button className="btn btn-small-inline" onClick={onShowOnMap}>
              Show on map
            </button>{' '}
            <button className="btn btn-icon" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </span>
        </div>
        <div className="reg-team-head">
          <div>
            <h2>{team.name}</h2>
            <div className="tp-sub muted">
              {team.country} · {regionLabel(team.region)} · {sectionLabel(team.section)}
            </div>
            <div className="tp-links">
              <a href={team.registryUrl} target="_blank" rel="noreferrer">
                Registry page ↗
              </a>
            </div>
          </div>
          <div className="reg-team-stats">
            <Stat label="Published" value={team.published} cls="v-published" />
            <Stat label="Screening" value={team.screening} cls="v-screening" />
            <Stat label="Draft" value={team.draft} cls="v-draft" />
            <Stat label="Rejected" value={team.rejected} />
            <Stat label="Docs pages" value={team.documentation} />
            <Stat label="Parts w/ docs" value={team.withDocs} />
          </div>
        </div>
        {team.found === false ? (
          <div className="tp-empty">This team has no organisation in the parts registry yet.</div>
        ) : team.found === null ? (
          <div className="tp-empty">Registry counts for this team are still being fetched…</div>
        ) : (
          <div className="reg-card-body">
            <StatusBar published={team.published} screening={team.screening} draft={team.draft} max={Math.max(1, total)} width={600} height={12} />
            <StatusLegend />
          </div>
        )}
      </section>

      <section className="panel reg-card">
        <div className="panel-title">
          <span>Count history</span>
          <span className="muted">changes since monitoring began</span>
        </div>
        <div className="reg-card-body">
          <HistoryChart history={team.history} now={now} />
        </div>
      </section>

      <section className="panel reg-card">
        <div className="panel-title">
          <span>Part types · published</span>
        </div>
        <div className="reg-card-body">{team.roles.length ? <HBars rows={team.roles} /> : <div className="muted">No published parts attributed yet.</div>}</div>
      </section>

      <section className="panel reg-card reg-wide">
        <div className="panel-title">
          <span>Published parts</span>
          <span className="muted">
            {team.parts.length} attributed{team.parts.length < team.published ? ` of ${team.published} (attribution in progress)` : ''}
          </span>
        </div>
        <div className="reg-card-body reg-table-wrap">
          <table className="tp-table parts-table">
            <thead>
              <tr>
                {th('name', 'Part')}
                <th>Title</th>
                {th('role', 'Type')}
                {th('seqLength', 'Length', true)}
                {th('usageCount', 'Used by', true)}
                {th('createdAt', 'Created', true)}
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.uuid}>
                  <td className="mono">
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {p.name}
                    </a>
                    {p.teamCount > 1 && (
                      <span className="tag tag-dim" title="Credited to more than one team">
                        shared
                      </span>
                    )}
                  </td>
                  <td className="part-title">{p.title}</td>
                  <td>{p.role ?? '—'}</td>
                  <td className="num">{p.seqLength ? `${fmtInt(p.seqLength)} bp` : '—'}</td>
                  <td className="num">{p.usageCount || ''}</td>
                  <td className="num muted" title={fmtUtc(p.createdAt)}>
                    {fmtAgo(p.createdAt, now)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(team.draft > 0 || team.drafts.length > 0) && (
        <section className="panel reg-card reg-wide">
          <div className="panel-title">
            <span>Draft parts</span>
            <span>
              <button className="btn btn-small-inline" onClick={syncDrafts} disabled={syncing === 'busy'}>
                {syncing === 'busy' ? 'Syncing…' : syncing === 'error' ? 'Sync failed — retry' : 'Sync drafts'}
              </button>{' '}
              <span className="muted">{team.drafts.length} synced{team.drafts.length < team.draft ? ` of ${team.draft} (sync in progress)` : ''}</span>
            </span>
          </div>
          <div className="reg-card-body reg-table-wrap">
            <table className="tp-table parts-table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th className="num">Length</th>
                  <th className="num">Updated</th>
                </tr>
              </thead>
              <tbody>
                {team.drafts.map((p) => (
                  <tr key={p.uuid}>
                    <td className="mono">
                      <a href={p.url} target="_blank" rel="noreferrer">
                        {p.name}
                      </a>
                    </td>
                    <td className="part-title">{p.title}</td>
                    <td>{p.role ?? '—'}</td>
                    <td className="num">{p.seqLength ? `${fmtInt(p.seqLength)} bp` : '—'}</td>
                    <td className="num muted" title={fmtUtc(p.updatedAt)}>
                      {fmtAgo(p.updatedAt, now)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${cls ?? ''}`}>{fmtInt(value)}</div>
    </div>
  );
}

const SERIES = [
  { key: 'published', label: 'Published', cls: 'ln-published' },
  { key: 'screening', label: 'Screening', cls: 'ln-screening' },
  { key: 'draft', label: 'Draft', cls: 'ln-draft' },
] as const;

/** Step lines of status counts over time, from snapshots taken whenever counts changed. Direct-labelled at the right edge. */
function HistoryChart({ history, now }: { history: RegistryTeamDetail['history']; now: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (history.length < 2) {
    return (
      <div className="muted caption">
        {history.length === 0 ? 'No snapshot yet.' : 'One snapshot so far — the chart fills in as this team’s counts change.'}
      </div>
    );
  }
  const W = 420;
  const H = 120;
  const R = 78; // room for direct labels
  const t0 = history[0].at;
  const t1 = Math.max(now, history[history.length - 1].at);
  const max = Math.max(1, ...history.flatMap((h) => [h.published, h.draft, h.screening]));
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * (W - R);
  const y = (v: number) => H - (v / max) * (H - 8);
  const last = history[history.length - 1];
  const path = (key: 'published' | 'draft' | 'screening') => {
    let d = `M${x(history[0].at)},${y(history[0][key])}`;
    for (const h of history.slice(1)) d += `H${x(h.at)}V${y(h[key])}`;
    return d + `H${x(t1)}`;
  };
  // Direct labels at the right edge, nudged apart so equal values don't overprint.
  const labels = SERIES.map((s) => ({ ...s, value: last[s.key], ly: y(last[s.key]) + 3 })).sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < labels.length; i++) labels[i].ly = Math.max(labels[i].ly, labels[i - 1].ly + 11);
  const hv = hover !== null ? history[hover] : null;

  return (
    <div className="chart">
      <div className="chart-readout">
        {hv ? `${fmtUtc(hv.at)} · ${hv.published} published · ${hv.screening} screening · ${hv.draft} draft` : `${history.length} snapshots since ${fmtUtc(t0)}`}
      </div>
      <svg viewBox={`0 0 ${W} ${H + 4}`} width="100%" onMouseLeave={() => setHover(null)}>
        {[0.5, 1].map((f) => (
          <line key={f} x1={0} x2={W - R} y1={y(max * f)} y2={y(max * f)} className="grid" />
        ))}
        <line x1={0} x2={W - R} y1={H} y2={H} className="axis" />
        {SERIES.map((s) => (
          <path key={s.key} d={path(s.key)} className={`hist-line ${s.cls}`} />
        ))}
        {labels.map((l) => (
          <text key={l.key} x={W - R + 6} y={l.ly} className="tick">
            {l.label} {l.value}
          </text>
        ))}
        {history.map((h, i) => (
          <rect key={h.at} x={x(h.at) - 4} y={0} width={8} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hv && <line x1={x(hv.at)} x2={x(hv.at)} y1={0} y2={H} className="crosshair" />}
      </svg>
    </div>
  );
}
