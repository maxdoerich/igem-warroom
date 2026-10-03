import type { FeedItem } from '../api';
import { fmtAgo, fmtInt, fmtUtc } from '../format';

interface Props {
  items: (FeedItem & { fresh?: boolean })[];
  homeSlug: string;
  onPick: (teamId: number) => void;
  now: number;
}

export function LiveFeed({ items, homeSlug, onPick, now }: Props) {
  return (
    <section className="feed panel">
      <div className="panel-title">
        <span>Intercepts · latest commits</span>
        <span className="muted">{items.length}</span>
      </div>
      <ul className="feed-list">
        {items.map((c) => (
          <li key={`${c.teamId}-${c.sha}`} className={`${c.fresh ? 'fresh' : ''} ${c.slug === homeSlug ? 'home' : ''}`}>
            <button onClick={() => onPick(c.teamId)}>
              <span className="feed-time" title={fmtUtc(c.at)}>
                {fmtAgo(c.at, now)}
              </span>
              <span className="feed-team">{c.teamName}</span>
              <span className="feed-title">{c.title}</span>
              <span className="delta">
                <span className="add">+{fmtInt(c.additions)}</span> <span className="del">−{fmtInt(c.deletions)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
