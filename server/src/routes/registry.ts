import type { FastifyInstance } from 'fastify';
import { registryFeed, registryOverview, registryTeamDetail, registryTeams } from '../stats/registry.ts';

export async function registryRoutes(app: FastifyInstance) {
  app.get('/api/registry/overview', async () => registryOverview());

  app.get('/api/registry/teams', async () => registryTeams());

  app.get<{ Params: { id: string } }>('/api/registry/teams/:id', async (req, reply) => {
    const detail = registryTeamDetail(Number(req.params.id));
    if (!detail) return reply.code(404).send({ error: 'team not found' });
    return detail;
  });

  app.get<{ Querystring: { limit?: string } }>('/api/registry/feed', async (req) =>
    registryFeed(Math.min(Number(req.query.limit ?? 60), 300)),
  );
}
