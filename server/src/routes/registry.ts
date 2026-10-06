import type { FastifyInstance } from 'fastify';
import { syncDrafts } from '../sync/registry.ts';
import { registryFeed, registryOverview, registryParts, registryTeamDetail, registryTeams } from '../stats/registry.ts';

export async function registryRoutes(app: FastifyInstance) {
  app.get('/api/registry/overview', async () => registryOverview());

  app.get('/api/registry/teams', async () => registryTeams());

  app.get('/api/registry/parts', async () => registryParts());

  app.get<{ Params: { id: string } }>('/api/registry/teams/:id', async (req, reply) => {
    const detail = registryTeamDetail(Number(req.params.id));
    if (!detail) return reply.code(404).send({ error: 'team not found' });
    return detail;
  });

  // Manual draft sync for one team; returns the refreshed detail.
  app.post<{ Params: { id: string } }>('/api/registry/teams/:id/drafts/sync', async (req, reply) => {
    const id = Number(req.params.id);
    if (!registryTeamDetail(id)) return reply.code(404).send({ error: 'team not found' });
    await syncDrafts(id, true);
    return registryTeamDetail(id);
  });

  app.get<{ Querystring: { limit?: string } }>('/api/registry/feed', async (req) =>
    registryFeed(Math.min(Number(req.query.limit ?? 60), 300)),
  );
}
