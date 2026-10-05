/**
 * @file dev-vercel.ts
 * @brief Local-only Vercel service listener using injected PORT, without scheduler or env-file overrides.
 */
import { createServer } from 'node:http';
import { createVercelHandler } from '../src/serverless/handler.js';
import { parsePort } from '../src/server.js';

const handler = createVercelHandler(process.env);
const server = createServer((req, res) => { void handler(req, res); });
server.listen(parsePort(process.env['PORT'], 0), '127.0.0.1');
