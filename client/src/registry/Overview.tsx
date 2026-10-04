import { useState } from 'react';
import type { RegistryOverview, RegistryTeamRow } from '../api';
import { fmtInt } from '../format';
import { DailyBars } from '../ui/TeamPanel';
import { StatusBar, StatusLegend } from './StatusBar';

const MAX_ROLES = 12;

export function Overview({ overview, teams, onPick }: { overview: RegistryOverview; teams: RegistryTeamRow[]; onPick: (t: RegistryTeamRow) => void }) {
  const { totals, parts, daily, roles } = overview;
  const shown = roles.slice(0, MAX_ROLES);
  const other = roles.slice(MAX_ROLES).reduce((a, r) => a + r.n, 0);
  const roleRows = other > 0 ? [...shown, { label: 'Other', n: other }] : shown;

  // Biggest unpublished backlogs: where the late surge of publications will come from.
  const backlog = [...teams]
    .filter((t) => t.draft + t.screening > 0)
    .sort((a, b) => b.draft + b.screening - (a.draft + a.screening))
    .slice(0, 10);
  const backlogMax = Math.max(1, ...backlog.map((t) => t.published + t.draft + t.screening));

  return (
    <div className="reg-overview">
      <section className="panel reg-card reg-wide">
        <div className="panel-title">
          <span>Published 2026 parts · by creation date · last 60 days</span>
          <span className="muted">{fmtInt(parts.listed)} published total</span>
        </div>
        <div className="reg-card-body">
          <DailyBars start={daily.start} counts={daily.counts} noun="part" barClass="bar bar-published" width={900} height={120} />
          <p className="caption">
            Creation date of parts that are published now; a part created as a draft and published later counts on its creation day.
          </p>
        </div>
      </section>

      <section className="panel reg-card">
        <div className="panel-title">
          <span>Status across all teams</span>
        </div>
        <div className="reg-card-body">
          <div className="big-status">
            <StatusBar published={totals.published} screening={totals.screening} draft={totals.draft} max={totals.published + totals.screening + totals.draft} width={420} height={14} />
          </div>
          <StatusLegend />
          <table className="tp-table reg-totals">
            <tbody>
              <tr>
                <td>Published</td>
                <td className="num v-published">{fmtInt(totals.published)}</td>
                <td className="muted">{totals.teamsPublishing} teams</td>
              </tr>
              <tr>
                <td>In screening</td>
                <td className="num v-screening">{fmtInt(totals.screening)}</td>
                <td />
              </tr>
              <tr>
                <td>Draft</td>
                <td className="num v-draft">{fmtInt(totals.draft)}</td>
                <td className="muted">{totals.teamsDrafting} teams</td>
              </tr>
              <tr>
                <td>Rejected</td>
                <td className="num">{fmtInt(totals.rejected)}</td>
                <td />
              </tr>
              <tr>
                <td>Documentation pages</td>
                <td className="num">{fmtInt(totals.documentation)}</td>
                <td />
              </tr>
            </tbody>
          </table>
          <p className="caption">
            Registry counts for {totals.summarised}/{totals.teams} teams. Draft and screening numbers are the registry&apos;s public aggregates; their
            contents are not collected.
          </p>
        </div>
      </section>

      <section className="panel reg-card">
        <div className="panel-title">
          <span>Part types · published</span>
        </div>
        <div className="reg-card-body">
          <HBars rows={roleRows} />
        </div>
      </section>

      <section className="panel reg-card reg-wide">
        <div className="panel-title">
          <span>Largest unpublished backlogs</span>
          <span className="muted">drafts + screening</span>
        </div>
        <div className="reg-card-body">
          <table className="tp-table backlog">
            <tbody>
              {backlog.map((t) => (
                <tr key={t.id} onClick={() => onPick(t)} className="clickable">
                  <td>{t.name}</td>
                  <td className="muted">{t.country}</td>
                  <td>
                    <StatusBar published={t.published} screening={t.screening} draft={t.draft} max={backlogMax} width={260} height={8} />
                  </td>
                  <td className="num v-published">{t.published}</td>
                  <td className={`num ${t.screening ? 'v-screening' : 'muted'}`}>{t.screening || '—'}</td>
                  <td className="num v-draft">{t.draft}</td>
                </tr>
              ))}
              {backlog.length === 0 && (
                <tr>
                  <td className="muted">No unpublished parts reported yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Horizontal magnitude bars, single hue, value labels in text ink. */
function HBars({ rows }: { rows: { label: string; n: number }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="hbars" onMouseLeave={() => setHover(null)}>
      {rows.map((r) => (
        <div key={r.label} className={`hbar-row ${hover === r.label ? 'hover' : ''}`} onMouseEnter={() => setHover(r.label)}>
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="num">{fmtInt(r.n)}</span>
        </div>
      ))}
    </div>
  );
}

export { HBars };
