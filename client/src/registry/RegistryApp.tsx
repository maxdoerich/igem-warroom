import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  type LivePart,
  type Meta,
  type RegistryFeedItem,
  type RegistryPartListItem,
  type RegistryOverview,
  type RegistryTeamDetail,
  type RegistryTeamRow,
} from '../api';
import { openChannel } from '../shared/channel';
import { Overview } from './Overview';
import { PartsExplorer } from './PartsExplorer';
import { PartsFeed } from './PartsFeed';
import { RegistryHud } from './RegistryHud';
import { TeamParts } from './TeamParts';
import { TeamTable } from './TeamTable';

const FEED_MAX = 120;

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Keep the "fresh" highlight on items that arrived live before a full refetch. */
function mergeFresh(next: RegistryFeedItem[], prev: RegistryFeedItem[]) {
  const fresh = new Set(prev.filter((p) => p.fresh).map((p) => p.uuid));
  return next.map((n) => ({ ...n, fresh: fresh.has(n.uuid) }));
}

export function RegistryApp() {
  const now = useNow(15_000);
  const [homeSlug, setHomeSlug] = useState('heidelberg');
  const [overview, setOverview] = useState<RegistryOverview | null>(null);
  const [teams, setTeams] = useState<RegistryTeamRow[]>([]);
  const [feed, setFeed] = useState<RegistryFeedItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RegistryTeamDetail | null>(null);
  const [connected, setConnected] = useState(false);
  const [view, setView] = useState<'overview' | 'parts'>('overview');
  const [parts, setParts] = useState<RegistryPartListItem[]>([]);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const viewRef = useRef(view);
  viewRef.current = view;

  const loadDetail = useCallback((id: number) => {
    api
      .registryTeam(id)
      .then((d) => {
        if (selectedRef.current === id) setDetail(d);
      })
      .catch(() => {});
  }, []);

  // Debounced full refresh; the initial load emits many "updated" hints.
  const timer = useRef<number | undefined>(undefined);
  const refresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      api.registryOverview().then(setOverview).catch(() => {});
      api.registryTeams().then(setTeams).catch(() => {});
      api
        .registryFeed(FEED_MAX)
        .then((f) => setFeed((prev) => mergeFresh(f, prev)))
        .catch(() => {});
      if (viewRef.current === 'parts') api.registryParts().then(setParts).catch(() => {});
      if (selectedRef.current !== null) loadDetail(selectedRef.current);
    }, 2000);
  }, [loadDetail]);

  useEffect(() => {
    const initial = Number(new URLSearchParams(window.location.search).get('team'));
    if (initial) select(initial, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api
      .meta()
      .then((m: Meta) => setHomeSlug(m.homeTeam))
      .catch(() => {});
    Promise.all([api.registryOverview(), api.registryTeams(), api.registryFeed(FEED_MAX)])
      .then(([o, t, f]) => {
        setOverview(o);
        setTeams(t);
        setFeed(f);
      })
      .catch(() => {});
  }, []);

  // Cross-window selection with the map.
  const channel = useRef<ReturnType<typeof openChannel> | null>(null);
  const select = useCallback(
    (id: number | null, broadcast = true) => {
      setSelectedId(id);
      setDetail(null);
      if (id !== null) loadDetail(id);
      if (broadcast) channel.current?.post({ type: 'select', teamId: id, source: 'registry' });
    },
    [loadDetail],
  );
  useEffect(() => {
    channel.current = openChannel((m) => {
      if (m.type === 'select' && m.source === 'map') select(m.teamId, false);
    });
    return () => channel.current?.close();
  }, [select]);

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener('registry-updated', refresh);
    es.addEventListener('registry-status', (e) => {
      const { status, budget } = JSON.parse((e as MessageEvent).data);
      setOverview((o) => (o ? { ...o, status, budget } : o));
    });
    es.addEventListener('parts', (e) => {
      const parts = JSON.parse((e as MessageEvent).data) as LivePart[];
      const items: RegistryFeedItem[] = parts.map((p) => ({
        uuid: p.uuid,
        name: p.name,
        slug: p.slug,
        title: p.title,
        role: p.role,
        seqLength: p.seqLength,
        createdAt: p.at,
        updatedAt: p.at,
        url: `https://registry.igem.org/parts/${p.slug}`,
        teams: p.teams,
        fresh: true,
      }));
      const ids = new Set(items.map((i) => i.uuid));
      setFeed((f) => [...items, ...f.filter((x) => !ids.has(x.uuid)).map((x) => ({ ...x, fresh: false }))].slice(0, FEED_MAX));
      refresh();
    });
    return () => es.close();
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  const focusMap = () => {
    if (window.opener && !window.opener.closed) window.opener.focus();
    else window.open('/', 'igem-warroom-map');
  };

  let center;
  if (selectedId !== null && detail) {
    center = (
      <TeamParts
        team={detail}
        isHome={detail.slug === homeSlug}
        onClose={() => select(null)}
        onShowOnMap={() => {
          channel.current?.post({ type: 'select', teamId: detail.id, source: 'registry' });
          focusMap();
        }}
        now={now}
        onDetail={(d) => selectedRef.current === d.id && setDetail(d)}
      />
    );
  } else if (selectedId !== null) {
    center = <div className="panel reg-card muted reg-loading">Loading team…</div>;
  } else if (overview) {
    center = (
      <>
        <div className="seg seg-inline reg-view">
          <button className={view === 'overview' ? 'on' : ''} onClick={() => setView('overview')}>
            OVERVIEW
          </button>
          <button
            className={view === 'parts' ? 'on' : ''}
            onClick={() => {
              setView('parts');
              api.registryParts().then(setParts).catch(() => {});
            }}
          >
            PARTS EXPLORER
          </button>
        </div>
        {view === 'parts' ? <PartsExplorer parts={parts} onPickTeam={(id) => select(id)} /> : <Overview overview={overview} teams={teams} onPick={(t) => select(t.id)} />}
      </>
    );
  } else {
    center = <div className="panel reg-card muted reg-loading">Connecting to server…</div>;
  }

  return (
    <div className="app">
      <RegistryHud overview={overview} connected={connected} now={now} onOpenMap={focusMap} />
      <main className="layout reg-layout">
        <TeamTable teams={teams} homeSlug={homeSlug} selectedId={selectedId} onPick={(t) => select(t.id)} now={now} />
        <div className="reg-center">{center}</div>
        <div className="right-col">
          <PartsFeed items={feed} homeSlug={homeSlug} onPickTeam={(id) => select(id)} now={now} />
        </div>
      </main>
    </div>
  );
}
