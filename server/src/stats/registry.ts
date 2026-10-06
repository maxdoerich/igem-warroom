import { db } from '../db/db.ts';
import { registry } from '../sources/registry.ts';
import { registryStatus } from '../sync/registry.ts';

const DAY = 86400_000;
const dayStart = (t: number) => Math.floor(t / DAY) * DAY;
export const partUrl = (slug: string) => `https://registry.igem.org/parts/${slug}`;

export interface RegistryTeamRow {
  id: number;
  slug: string;
  name: string;
  country: string | null;
  region: string | null;
  section: string | null;
  found: boolean | null; // null = not fetched yet
  published: number;
  draft: number;
  screening: number;
  rejected: number;
  withDocs: number;
  documentation: number;
  partsKnown: number; // published parts we've attributed to the team
  new7d: number; // of those, created in the last 7 days
  lastPartAt: number | null;
  fetchedAt: number | null;
}

export function registryTeams(now = Date.now()): RegistryTeamRow[] {
  const rows = db
    .prepare(`
      SELECT t.id, t.slug, t.name, t.country, t.region, t.section,
             s.found, COALESCE(s.published, 0) AS published, COALESCE(s.draft, 0) AS draft,
             COALESCE(s.screening, 0) AS screening, COALESCE(s.rejected, 0) AS rejected,
             COALESCE(s.with_docs, 0) AS withDocs, COALESCE(s.documentation, 0) AS documentation, s.fetched_at AS fetchedAt,
             COUNT(p.uuid) AS partsKnown,
             COALESCE(SUM(p.created_at >= :d7), 0) AS new7d,
             MAX(p.created_at) AS lastPartAt
      FROM teams t
      LEFT JOIN reg_summary s ON s.team_id = t.id
      LEFT JOIN reg_part_teams pt ON pt.team_id = t.id
      LEFT JOIN reg_parts p ON p.uuid = pt.part_uuid
      GROUP BY t.id`)
    .all({ d7: now - 7 * DAY }) as any[];
  return rows.map((r) => ({ ...r, found: r.found === null ? null : Boolean(r.found) }));
}

export function registryOverview(now = Date.now()) {
  const totals = db
    .prepare(`
      SELECT COALESCE(SUM(published), 0) AS published, COALESCE(SUM(draft), 0) AS draft,
             COALESCE(SUM(screening), 0) AS screening, COALESCE(SUM(rejected), 0) AS rejected,
             COALESCE(SUM(documentation), 0) AS documentation,
             COUNT(*) AS summarised, COALESCE(SUM(found), 0) AS withOrg,
             COALESCE(SUM(published > 0), 0) AS teamsPublishing, COALESCE(SUM(draft > 0), 0) AS teamsDrafting
      FROM reg_summary`)
    .get() as Record<string, number>;
  const parts = db
    .prepare(`
      SELECT COUNT(*) AS listed, COALESCE(SUM(attributed), 0) AS attributed,
             COALESCE(SUM(created_at >= :d1), 0) AS created24h, COALESCE(SUM(created_at >= :d7), 0) AS created7d
      FROM reg_parts`)
    .get({ d1: now - DAY, d7: now - 7 * DAY }) as Record<string, number>;
  const teamCount = (db.prepare('SELECT COUNT(*) AS n FROM teams').get() as { n: number }).n;

  const DAYS = 60;
  const start = dayStart(now) - (DAYS - 1) * DAY;
  const daily = new Array(DAYS).fill(0);
  for (const r of db.prepare('SELECT created_at FROM reg_parts WHERE created_at >= ?').all(start) as { created_at: number }[]) {
    const i = Math.floor((r.created_at - start) / DAY);
    if (i >= 0 && i < DAYS) daily[i]++;
  }

  const roles = db
    .prepare(`
      SELECT COALESCE(role_label, 'Unspecified') AS label, COUNT(*) AS n
      FROM reg_parts GROUP BY label ORDER BY n DESC`)
    .all() as { label: string; n: number }[];

  return {
    totals: { ...totals, teams: teamCount },
    parts,
    daily: { start, counts: daily },
    roles: roles.map((r) => ({ ...r })),
    status: registryStatus,
    budget: registry.budget,
  };
}

export function registryTeamDetail(teamId: number) {
  const row = registryTeams().find((t) => t.id === teamId);
  if (!row) return undefined;
  const parts = (
    db
      .prepare(`
        SELECT p.uuid, p.name, p.slug, p.title, p.role_label AS role, p.seq_length AS seqLength,
               p.usage_count AS usageCount, p.created_at AS createdAt, p.updated_at AS updatedAt,
               (SELECT COUNT(*) FROM reg_part_teams x WHERE x.part_uuid = p.uuid) AS teamCount
        FROM reg_parts p JOIN reg_part_teams pt ON pt.part_uuid = p.uuid
        WHERE pt.team_id = ? ORDER BY p.created_at DESC`)
      .all(teamId) as any[]
  ).map((p) => ({ ...p, url: partUrl(p.slug) }));
  const drafts = (
    db
      .prepare(`
        SELECT uuid, name, slug, title, role_label AS role, seq_length AS seqLength, created_at AS createdAt, updated_at AS updatedAt
        FROM reg_drafts WHERE team_id = ? ORDER BY created_at DESC`)
      .all(teamId) as any[]
  ).map((p) => ({ ...p, url: partUrl(p.slug) }));
  const history = (
    db
      .prepare('SELECT at, published, draft, screening, rejected FROM reg_summary_history WHERE team_id = ? ORDER BY at')
      .all(teamId) as any[]
  ).map((h) => ({ ...h }));
  const roles = new Map<string, number>();
  for (const p of parts) roles.set(p.role ?? 'Unspecified', (roles.get(p.role ?? 'Unspecified') ?? 0) + 1);
  return {
    ...row,
    parts,
    drafts,
    history,
    roles: [...roles].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    registryUrl: `https://registry.igem.org/organisations/igem/${teamId}`,
  };
}

export function registryFeed(limit = 60) {
  const parts = db
    .prepare(`
      SELECT uuid, name, slug, title, role_label AS role, seq_length AS seqLength, created_at AS createdAt,
             updated_at AS updatedAt, first_seen_at AS firstSeenAt
      FROM reg_parts ORDER BY updated_at DESC LIMIT ?`)
    .all(limit) as any[];
  const teamsOf = db.prepare(`
    SELECT t.id, t.name, t.slug FROM reg_part_teams pt JOIN teams t ON t.id = pt.team_id WHERE pt.part_uuid = ?`);
  return parts.map((p) => ({ ...p, url: partUrl(p.slug), teams: (teamsOf.all(p.uuid) as any[]).map((t) => ({ ...t })) }));
}

/** Every published part with its teams, for the parts explorer (client-side filtering and grouping). */
export function registryParts() {
  const parts = db
    .prepare(`
      SELECT uuid, name, slug, title, role_label AS role, seq_length AS seqLength, usage_count AS usageCount,
             created_at AS createdAt, updated_at AS updatedAt
      FROM reg_parts ORDER BY usage_count DESC, created_at DESC`)
    .all() as any[];
  const teamsOf = new Map<string, { id: number; name: string; slug: string }[]>();
  for (const r of db
    .prepare('SELECT pt.part_uuid AS uuid, t.id, t.name, t.slug FROM reg_part_teams pt JOIN teams t ON t.id = pt.team_id')
    .all() as any[]) {
    const list = teamsOf.get(r.uuid) ?? [];
    list.push({ id: r.id, name: r.name, slug: r.slug });
    teamsOf.set(r.uuid, list);
  }
  return parts.map((p) => {
    const teams = teamsOf.get(p.uuid) ?? [];
    return { ...p, url: partUrl(p.slug), teams, teamCount: teams.length };
  });
}
