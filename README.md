# iGEM Warroom

Local tactical dashboard for the iGEM 2026 competition: an interactive Equal Earth world map with a
marker per team, live-monitoring each team's wiki repository on `gitlab.igem.org`.

## Run

Requires Node.js ≥ 24 (uses the built-in `node:sqlite` and native TypeScript type stripping).

```sh
npm install
npm run build      # build the client once
npm start          # http://127.0.0.1:8787 — server + sync + built client
```

For development with hot reload: `npm run dev` (Vite on http://localhost:5173, proxying `/api` to the server).

Optional configuration: copy `.env.example` to `.env`.

| Variable | Default | |
|---|---|---|
| `GITLAB_TOKEN` | — | Personal access token (`read_api` scope). Raises the API budget well beyond the anonymous 600 req/h. |
| `POLL_INTERVAL_SEC` | 180 | Change-detection interval |
| `HOME_TEAM` | `heidelberg` | Team slug highlighted on the map |
| `WIKI_FREEZE_AT` | `2026-10-21T15:00:00Z` | Countdown target |

## Data sources

- **Team registry** — `api.igem.org/v1/teams?year=2026` (list) and `/teams/:id` (slug, lat/lng, institution).
  Refreshed every 24 h; per-team detail records are re-fetched weekly.
- **Wiki repositories** — `gitlab.igem.org/2026/<slug>`. The `2026` group is hidden from anonymous users,
  but its public projects are discoverable via namespace search and are readable without a token.
- Teams without a public repo (private, not created yet, or non-competition programs) are shown as
  dashed hollow markers.
- **Coordinates** — the registry's are used when they fall inside the team's country (or within 75 km
  of its coast / 25 km of its border; checked against Natural Earth 1:50m outlines). Missing, `0,0`
  placeholder, or out-of-country coordinates are geocoded once via OpenStreetMap Nominatim
  (institution name first, then city) and cached in the `geocode_cache` table. City-level fixes are
  marked "location approximate" in the tooltip.

## How syncing works

The anonymous GitLab API budget is **600 requests/hour**, so everything is budget-aware
(`server/src/sources/gitlab.ts` tracks `RateLimit-Remaining`/`RateLimit-Reset`):

1. **Backfill** (once per team, background): full default-branch history with per-commit line stats.
   Pauses when the budget drops to the reserve and resumes after the hourly reset.
2. **Poll** (every 3 min): one query for public projects with `last_activity_after` the previous poll,
   filtered to the `2026/` namespace; only changed teams get their newest commits fetched.
   Polling may dip into the reserved budget.
3. **Sweep** (each poll, if budget allows): re-checks the least recently synced teams, as a safety net
   in case GitLab's `last_activity_at` lags behind a push.

New commits are pushed to the browser over Server-Sent Events (`/api/events`).

Commits up to 5 minutes after a project's creation are the iGEM template, flagged `is_template`
and excluded from all stats. Only the default branch is tracked; timestamps are committer dates.

## Layout

```
server/src/
  sources/   gitlab.ts (rate-limited client), igem.ts (registry), http.ts
  sync/      teams.ts, commits.ts, scheduler.ts
  stats/     aggregate.ts (per-team metrics, heat, ranks, feed)
  routes/    api.ts (REST + SSE)
  cli.ts     npm run sync:teams | sync:commits (manual runs; don't run alongside the server)
client/src/
  map/       WorldMap.tsx (canvas, d3-geo Equal Earth, d3-zoom, quadtree hit-testing), heat.ts
  ui/        Hud, Leaderboard, TeamPanel, LiveFeed, Tooltip, MapLegend, Sparkline
data/        SQLite database (gitignored)
```

## Metrics

- **Heat** — Σ exp(−age / 48 h) over a team's commits; colour on a single-hue amber ramp, log-normalised.
- **Marker size** — area ∝ total team commits.
- **Weekly rhythm** — hour × weekday, shifted from UTC by the team's solar offset (longitude / 15).
