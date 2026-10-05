/**
 * @file +server.ts
 * @brief Reserves the full API route surface for the serverless hook dispatcher.
 */
import type { RequestHandler } from './$types';

/**
 * @brief Fails closed when an API catch-all is reached outside serverless dispatch.
 * @return Not found response.
 */
const unavailable: RequestHandler = () => new Response(null, { status: 404 });
export const GET = unavailable;
export const POST = unavailable;
export const PUT = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;
export const OPTIONS = unavailable;
export const HEAD = unavailable;
