/**
 * @file build-vercel.mjs
 * @brief Builds independent API/frontend Vercel services using pinned workspace tools.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pnpmInvocation } from './pnpm-invocation.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const executable = process.env['npm_execpath'];
if (!executable?.includes('pnpm')) { throw new Error('Use pnpm build:vercel'); }
const env = { ...process.env, DEPLOYMENT_TARGET: 'vercel', SCHEDULER_ENABLED: 'false' };
/** @brief Runs a pinned package script with either native or JS pnpm. @param {string[]} args Arguments. @return {void} Completion. */
function run(args) {
	const invocation = pnpmInvocation(executable, args);
	execFileSync(invocation.command, invocation.args, { cwd: root, env, stdio: 'inherit' });
}
if (!process.argv.includes('--frontend-only')) {
	run(['--filter', 'benchcore-api', 'build:vercel']);
}
run(['--filter', 'benchcore-frontend', 'build']);
