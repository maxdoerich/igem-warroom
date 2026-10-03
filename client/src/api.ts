export interface TeamSummary {
  id: number;
  slug: string;
  name: string;
  institution: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  section: string | null;
  status: string | null;
  lat: number | null;
  lng: number | null;
  gitlabPath: string | null;
  synced: boolean;
  commits: number;
  lastCommitAt: number | null;
  c24h: number;
  c7d: number;
  c30d: number;
  additions: number;
  deletions: number;
  contributors: number;
  heat: number;
  spark: number[];
  rank7d: number | null;
  rankTotal: number | null;
}

export interface TeamDetail extends TeamSummary {
  wikiUrl: string;
  repoUrl: string | null;
  regionRank7d: number | null;
  regionTeams: number;
  daily: { start: number; counts: number[] };
  hourWeekday: number[][];
  authors: { name: string; commits: number; additions: number; deletions: number; lastAt: number }[];
  recent: { sha: string; title: string; author: string; at: number; additions: number; deletions: number }[];
}

export interface FeedItem {
  teamId: number;
  teamName: string;
  slug: string;
  sha: string;
  title: string;
  author: string;
  at: number;
  additions: number;
  deletions: number;
}

export interface Budget {
  authenticated: boolean;
  remaining: number | null;
  resetAt: number | null;
  requestsMade: number;
  throttledUntil: number | null;
  pausedUntil: number | null;
}

export interface Meta {
  year: number;
  homeTeam: string;
  wikiFreezeAt: string;
  pollIntervalSec: number;
  serverTime: number;
  sync: {
    phase: 'idle' | 'teams' | 'backfill' | 'polling';
    teamsSyncedAt: number | null;
    lastPollAt: number | null;
    lastPollError: string | null;
    backfill: { total: number; done: number; errors: number; running: boolean };
  };
  budget: Budget;
  stats: { last24h: { commits: number; teams: number }; last7d: { commits: number; teams: number }; totalCommits: number };
}

/** SSE "commits" payload: a NewCommit joined with team name/slug. */
export interface LiveCommit {
  teamId: number;
  sha: string;
  committedAt: number;
  authorName: string;
  title: string;
  additions: number;
  deletions: number;
  name: string;
  slug: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => get<Meta>('/api/meta'),
  teams: () => get<TeamSummary[]>('/api/teams'),
  team: (id: number) => get<TeamDetail>(`/api/teams/${id}`),
  feed: (limit = 60) => get<FeedItem[]>(`/api/feed?limit=${limit}`),
};
