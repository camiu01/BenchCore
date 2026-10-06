/**
 * @file pnpm-invocation.test.ts
 * @brief Native Windows pnpm must not be interpreted as JavaScript during release builds.
 */
import { describe, expect, it } from 'vitest';
import { pnpmInvocation } from '../../scripts/pnpm-invocation.mjs';

describe('release package manager launcher', () => {
	it('uses Node for JavaScript launchers and directly executes Windows binaries without a shell', () => {
		expect(pnpmInvocation('/tools/pnpm.cjs', ['build'], '/tools/node')).toEqual({
			command: '/tools/node',
			args: ['/tools/pnpm.cjs', 'build']
		});
		expect(pnpmInvocation('C:\\tools\\pnpm.exe', ['build'], 'C:\\node.exe')).toEqual({
			command: 'C:\\tools\\pnpm.exe',
			args: ['build']
		});
		for (const input of [undefined, '/tools/npm.cjs', '/tools/pnpm.cmd'])
			expect(() => pnpmInvocation(input, [])).toThrow();
	});
});
