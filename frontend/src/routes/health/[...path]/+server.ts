/**
 * @file +server.ts
 * @brief Reserves liveness and readiness endpoints for the serverless hook.
 */
import type { RequestHandler } from './$types';

/** @brief The hook handles real probes; other deployment modes fail closed. */
export const GET: RequestHandler = () => new Response(null, { status: 404 });
