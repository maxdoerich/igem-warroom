import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT_DIR } from './config.ts';
import { gitlab } from './sources/gitlab.ts';
import { mapPool } from './sources/http.ts';
import { syncTeamCommits, teamsNeedingBackfill } from './sync/commits.ts';
import { syncTeams } from './sync/teams.ts';

const cmd = process.argv[2];

if (cmd === 'teams') {
  const report = await syncTeams();
  const out = path.join(ROOT_DIR, 'data', 'team-sync-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`report written to ${out}`);
  if (report.unmatched.length) {
    console.log('unmatched teams:');
    for (const t of report.unmatched) console.log(`  ${t.name} (${t.slug})`);
  }
} else if (cmd === 'commits') {
  const todo = teamsNeedingBackfill();
  console.log(`backfilling ${todo.length} teams (${config.gitlabToken ? 'token' : 'anonymous'})…`);
  let done = 0;
  const { errors } = await mapPool(todo, config.gitlabConcurrency, async (team) => {
    await syncTeamCommits(team, { full: true });
    if (++done % 25 === 0) {
      console.log(`  ${done}/${todo.length}  budget remaining: ${gitlab.budget.remaining ?? 'n/a'}`);
    }
  });
  console.log(`done: ${done} ok, ${errors.length} errors, ${gitlab.budget.requestsMade} requests`);
  for (const e of errors.slice(0, 10)) console.log(`  ${e.item.slug}: ${String(e.error)}`);
} else {
  console.log('usage: node src/cli.ts <teams|commits>');
  process.exit(1);
}
