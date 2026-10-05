/**
 * @file build-vercel.mjs
 * @brief Builds the complete SvelteKit serverless application using pinned workspace tools.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const executable = process.env['npm_execpath'];
if (!executable?.includes('pnpm')) { throw new Error('Use pnpm build:vercel'); }
const env = { ...process.env, DEPLOYMENT_TARGET: 'vercel', SCHEDULER_ENABLED: 'false' };
execFileSync(process.execPath, [executable, '--filter', 'benchcore-api', 'build'], { cwd: root, env, stdio: 'inherit' });
execFileSync(process.execPath, [executable, '--filter', 'benchcore-frontend', 'build'], { cwd: root, env, stdio: 'inherit' });
