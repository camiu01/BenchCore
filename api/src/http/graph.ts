/**
 * @file graph.ts
 * @brief Public graph endpoint adapter.
 */
import { buildPublicGraph } from '../posts/graph-service.js';
import type { ApiHandler } from './types.js';
import { sendJson } from './response.js';

/**
 * @brief Returns published posts and valid wikilink edges.
 * @param req Request.
 * @param res Response.
 * @param deps Repositories.
 * @return Completion.
 */
export const handleGraph: ApiHandler = async (_req, res, deps) => {
	sendJson(res, 200, await buildPublicGraph(deps.posts, deps.tags));
};
