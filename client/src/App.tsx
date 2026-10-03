import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type FeedItem, type LiveCommit, type Meta, type TeamDetail, type TeamSummary } from './api';
import { WorldMap, type WorldMapHandle } from './map/WorldMap';
import { Hud } from './ui/Hud';
import { Leaderboard, type Filters, type Metric } from './ui/Leaderboard';
import { LiveFeed } from './ui/LiveFeed';
import { MapLegend } from './ui/MapLegend';
import { Replay, type ReplayOverride } from './ui/Replay';
import { TeamPanel } from './ui/TeamPanel';
import { Tooltip } from './ui/Tooltip';

type FeedEntry = FeedItem & { fresh?: boolean };

const FEED_MAX = 80;

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Collapse bursts of calls into one trailing call. */
function useDebounced(fn: () => void, ms: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<number | undefined>(undefined);
  return useCallback(() => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => fnRef.current(), ms);
  }, [ms]);
}

export function App() {
  const now = useNow();
  // Lists re-render slowly; only the HUD clock needs per-second updates.
  const slowNow = useNow(15_000);
  const mapRef = useRef<WorldMapHandle>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hover, setHover] = useState<{ team: TeamSummary; x: number; y: number } | null>(null);
  const [metric, setMetric] = useState<Metric>('c7d');
  const [filters, setFilters] = useState<Filters>({ query: '', region: '', section: '', activeOnly: false });
  const [error, setError] = useState<string | null>(null);
  const [replay, setReplay] = useState<ReplayOverride | null>(null);

  const homeSlug = meta?.homeTeam ?? 'heidelberg';
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const d = await api.team(id);
      if (selectedRef.current === id) setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refresh = useDebounced(() => {
    api.teams().then(setTeams).catch(() => {});
    api.meta().then(setMeta).catch(() => {});
    if (selectedRef.current !== null) loadDetail(selectedRef.current).catch(() => {});
  }, 1500);

  // Initial load.
  useEffect(() => {
    Promise.all([api.meta(), api.teams(), api.feed(FEED_MAX)])
      .then(([m, t, f]) => {
        setMeta(m);
        setTeams(t);
        setFeed(f);
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Live stream.
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener('meta', (e) => setMeta(JSON.parse((e as MessageEvent).data)));
    es.addEventListener('budget', (e) => {
      const budget = JSON.parse((e as MessageEvent).data);
      setMeta((m) => (m ? { ...m, budget } : m));
    });
    es.addEventListener('teams-updated', () => refresh());
    es.addEventListener('commits', (e) => {
      const commits = JSON.parse((e as MessageEvent).data) as LiveCommit[];
      const entries: FeedEntry[] = commits.map((c) => ({
        teamId: c.teamId,
        teamName: c.name,
        slug: c.slug,
        sha: c.sha,
        title: c.title,
        author: c.authorName,
        at: c.committedAt,
        additions: c.additions,
        deletions: c.deletions,
        fresh: true,
      }));
      setFeed((f) => [...entries, ...f.map((x) => ({ ...x, fresh: false }))].sort((a, b) => b.at - a.at).slice(0, FEED_MAX));
      for (const id of new Set(commits.map((c) => c.teamId))) mapRef.current?.pulse(id);
      refresh();
    });
    return () => es.close();
  }, [refresh]);

  const isVisible = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return (t: TeamSummary) =>
      (!q || [t.name, t.city, t.country, t.institution].some((v) => v?.toLowerCase().includes(q))) &&
      (!filters.region || t.region === filters.region) &&
      (!filters.section || (t.section ?? 'other') === filters.section) &&
      (!filters.activeOnly || t.c7d > 0);
  }, [filters]);

  const visible = useMemo(() => teams.filter(isVisible), [teams, isVisible]);

  const select = useCallback(
    (team: TeamSummary | null, fly = false) => {
      setSelectedId(team?.id ?? null);
      setDetail(null);
      if (!team) return;
      loadDetail(team.id).catch(() => {});
      if (fly) mapRef.current?.flyTo(team.id);
    },
    [loadDetail],
  );

  const pickById = useCallback(
    (id: number) => {
      const t = teams.find((x) => x.id === id);
      if (t) select(t, true);
    },
    [teams, select],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  const onHover = useCallback((team: TeamSummary | null, x: number, y: number) => {
    setHover(team ? { team, x, y } : null);
  }, []);

  return (
    <div className="app">
      <Hud meta={meta} teams={teams} connected={connected} now={now} />
      <main className="layout">
        <Leaderboard
          teams={teams}
          visible={visible}
          metric={metric}
          onMetric={setMetric}
          filters={filters}
          onFilters={setFilters}
          homeSlug={homeSlug}
          selectedId={selectedId}
          onPick={(t) => select(t, true)}
          now={slowNow}
        />
        <div className="map-area">
          <WorldMap
            ref={mapRef}
            teams={teams}
            homeSlug={homeSlug}
            selectedId={selectedId}
            isVisible={isVisible}
            onHover={onHover}
            onSelect={(t) => select(t)}
            override={replay}
          />
          <Replay teams={teams} onOverride={setReplay} />
          <MapLegend onReset={() => mapRef.current?.resetView()} />
          {error && <div className="map-error panel">Cannot reach server: {error}</div>}
          {!error && teams.length === 0 && <div className="map-error panel">Waiting for team registry sync…</div>}
        </div>
        <div className={`right-col ${selectedId !== null ? 'has-target' : ''}`}>
          {selectedId !== null && (
            <TeamPanel team={detail} loading={detailLoading} isHome={detail?.slug === homeSlug} onClose={() => select(null)} now={now} />
          )}
          <LiveFeed items={feed} homeSlug={homeSlug} onPick={pickById} now={slowNow} />
        </div>
      </main>
      {hover && <Tooltip team={hover.team} x={hover.x} y={hover.y} now={now} />}
    </div>
  );
}
