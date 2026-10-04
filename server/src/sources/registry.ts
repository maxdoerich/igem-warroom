import { EventEmitter } from 'node:events';
import { HttpError, Semaphore, sleep } from './http.ts';

const BASE = 'https://api.registry.igem.org/v1';

/**
 * The parts registry rate-limits in three sliding windows, reported per response as
 * x-ratelimit-{remaining,reset}-{short,medium,large} (reset in seconds). Observed limits:
 * 5 / ~5s, 30 / ~50s, 100 / ~10min. Requests run one at a time and wait whenever a
 * window is about to run dry; the large window keeps a reserve for the live poll.
 */
const WINDOWS = ['short', 'medium', 'large'] as const;
type WindowName = (typeof WINDOWS)[number];
const LARGE_RESERVE = 12;

export interface RegistryPart {
  uuid: string;
  name: string;
  slug: string;
  status: string;
  title: string;
  role: { label: string; accession: string } | null;
  sequenceLength: number | null;
  audit: { created: string; updated: string };
  usageCount: number;
}

export interface RegistrySummary {
  parts: {
    total: number;
    byStatus: { draft: number; screening: number; published: number; rejected: number };
    withDocumentation: number;
    withoutDocumentation: number;
  };
  collections: { total: number };
  documentation: { total: number };
}

export interface RegistryOrg {
  uuid: string;
  name: string;
  type: string;
  link: string | null;
}

export interface RegistryBudget {
  windows: Record<WindowName, { remaining: number | null; resetAt: number | null }>;
  requestsMade: number;
  waitingUntil: number | null;
}

class RegistryClient extends EventEmitter {
  readonly budget: RegistryBudget = {
    windows: {
      short: { remaining: null, resetAt: null },
      medium: { remaining: null, resetAt: null },
      large: { remaining: null, resetAt: null },
    },
    requestsMade: 0,
    waitingUntil: null,
  };
  private readonly sem = new Semaphore(1);

  private async waitForBudget(critical: boolean) {
    for (;;) {
      const now = Date.now();
      let until = 0;
      for (const w of WINDOWS) {
        const { remaining, resetAt } = this.budget.windows[w];
        const floor = w === 'large' && !critical ? LARGE_RESERVE : 0;
        if (remaining !== null && resetAt !== null && remaining <= floor && resetAt > now) until = Math.max(until, resetAt);
      }
      if (!until) {
        if (this.budget.waitingUntil) {
          this.budget.waitingUntil = null;
          this.emit('budget', this.budget);
        }
        return;
      }
      if (!critical) {
        this.budget.waitingUntil = until;
        this.emit('budget', this.budget);
      }
      await sleep(Math.min(until - now + 300, 60_000));
    }
  }

  private updateBudget(headers: Headers) {
    const now = Date.now();
    for (const w of WINDOWS) {
      const remaining = headers.get(`x-ratelimit-remaining-${w}`);
      const reset = headers.get(`x-ratelimit-reset-${w}`);
      if (remaining !== null) this.budget.windows[w].remaining = Number(remaining);
      if (reset !== null) this.budget.windows[w].resetAt = now + Number(reset) * 1000;
    }
    this.emit('budget', this.budget);
  }

  async get<T>(path: string, opts: { critical?: boolean; allow404?: boolean } = {}): Promise<T | null> {
    const url = BASE + path;
    for (let attempt = 0; ; attempt++) {
      // Wait outside the semaphore so a paused background request never blocks a critical one.
      await this.waitForBudget(Boolean(opts.critical));
      const res = await this.sem.run(async () => {
        for (const w of WINDOWS) {
          const win = this.budget.windows[w];
          if (win.remaining !== null) win.remaining--;
        }
        this.budget.requestsMade++;
        const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        this.updateBudget(r.headers);
        return r;
      });
      if (res.status === 429) {
        const wait = Number(res.headers.get('retry-after') ?? res.headers.get('x-ratelimit-reset-large') ?? 60);
        this.budget.windows.large = { remaining: 0, resetAt: Date.now() + wait * 1000 };
        continue;
      }
      if (res.status >= 500 && attempt < 3) {
        await sleep(2 ** attempt * 3000);
        continue;
      }
      if (res.status === 404 && opts.allow404) return null;
      if (!res.ok) throw new HttpError(res.status, url, await res.text());
      return (await res.json()) as T;
    }
  }

  /**
   * Published 2026 parts (anonymous callers only ever receive published parts from this endpoint).
   * The `BBa_26` name prefix is how the registry numbers this year's parts.
   */
  async listPublished(opts: { page: number; pageSize: number; sort: string; critical?: boolean }) {
    const q = new URLSearchParams({ name: 'BBa_26', page: String(opts.page), pageSize: String(opts.pageSize), sort: opts.sort });
    return (await this.get<{ data: RegistryPart[]; total: number }>(`/parts?${q}`, { critical: opts.critical }))!;
  }

  /** Organisations credited on a part; iGEM teams link to teams.igem.org/<teamId>. */
  async partOrganisations(uuid: string, critical = false) {
    return (await this.get<RegistryOrg[]>(`/parts/${uuid}/authors/organisations`, { critical, allow404: true })) ?? [];
  }

  /** Public aggregate counts per status (draft / screening / published / rejected). */
  teamSummary(teamId: number) {
    return this.get<RegistrySummary>(`/organisations/igem/${teamId}/summary`, { allow404: true });
  }
}

export const registry = new RegistryClient();

export function teamIdFromOrg(org: RegistryOrg): number | null {
  if (org.type !== 'igem-team' || !org.link) return null;
  const m = org.link.match(/teams\.igem\.org\/(\d+)/);
  return m ? Number(m[1]) : null;
}
