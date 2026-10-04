import type { RegistryFeedItem } from '../api';
import { fmtAgo, fmtInt, fmtUtc } from '../format';

export function PartsFeed({ items, homeSlug, onPickTeam, now }: { items: RegistryFeedItem[]; homeSlug: string; onPickTeam: (id: number) => void; now: number }) {
  return (
    <section className="feed panel">
      <div className="panel-title">
        <span>Latest published / updated parts</span>
        <span className="muted">{items.length}</span>
      </div>
      <ul className="feed-list parts-feed">
        {items.map((p) => (
          <li key={p.uuid} className={`${p.fresh ? 'fresh' : ''} ${p.teams.some((t) => t.slug === homeSlug) ? 'home' : ''}`}>
            <div className="pf-row">
              <span className="feed-time" title={`updated ${fmtUtc(p.updatedAt)}`}>
                {fmtAgo(p.updatedAt, now)}
              </span>
              <span className="pf-main">
                <span className="pf-top">
                  <a className="mono" href={p.url} target="_blank" rel="noreferrer">
                    {p.name}
                  </a>
                  <span className="muted">
                    {p.role ?? '—'}
                    {p.seqLength ? ` · ${fmtInt(p.seqLength)} bp` : ''}
                  </span>
                </span>
                <span className="feed-title">{p.title}</span>
                <span className="pf-teams">
                  {p.teams.length === 0 ? (
                    <span className="muted">team lookup pending</span>
                  ) : (
                    p.teams.map((t) => (
                      <button key={t.id} className="team-chip" onClick={() => onPickTeam(t.id)}>
                        {t.name}
                      </button>
                    ))
                  )}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
