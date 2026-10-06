/**
 * @file pnpm-invocation.mjs
 * @brief Executes either pnpm's JavaScript entrypoint or Windows native executable without a shell.
 */

/** @brief Selects the correct launcher for the package manager that started this process. @param {string | undefined} executable npm_execpath. @param {string[]} args pnpm arguments. @param {string} node Node executable. @return {{command: string; args: string[]}} Shell-free invocation. */
export function pnpmInvocation(executable, args, node = process.execPath) {
	if (!executable?.includes('pnpm')) throw new Error('Run this command with the pinned pnpm');
	if (/\.[cm]?js$/i.test(executable)) return { command: node, args: [executable, ...args] };
	if (/\.exe$/i.test(executable)) return { command: executable, args };
	throw new Error('Unsupported pnpm launcher');
}
