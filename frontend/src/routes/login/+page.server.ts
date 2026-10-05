/**
 * @file +page.server.ts
 * @brief * Login page: redirects authenticated users, forwards credentials to the API.
 */
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { applySessionCookie } from '../../lib/server/auth-cookie.js';
import type { Actions, PageServerLoad } from './$types';
import { mutationOrigin } from '../../lib/site.js';
import { apiBase } from '../../lib/api.js';
import { apiFetch } from '../../lib/server/transport.js';
import { sessionSchema } from '../../lib/server/session.js';

/**
 * @brief Redirects authenticated visitors to the dashboard.
 * @param event The current request event.
 * @return The result, or a redirect for completed mutations.
 */
export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user !== null) {
		throw redirect(303, locals.user.role === 'admin' ? '/admin' : '/account');
	}
	const notice = url.searchParams.has('passwordReset')
		? 'Password reset. You can now sign in.'
		: url.searchParams.has('passwordChanged')
			? 'Password changed. Sign in again.'
			: url.searchParams.has('registered')
				? 'Account created. You can now sign in.'
				: null;
	return { notice };
};

export const actions: Actions = {
	/**
	 * @brief Authenticates against the API and stores the session cookie.
	 * @param event The current request event.
	 * @return The result, or a redirect for completed mutations.
	 */
	login: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = form.get('password');
		const input = z
			.object({
				email: z.union([z.email().max(254), z.string().regex(/^[a-z][a-z0-9_-]{2,31}$/i)]),
				password: z.string().min(1).max(200)
			})
			.safeParse({ email, password });
		if (!input.success) {
			return fail(400, { error: 'Enter a valid username or email and password.', email });
		}
		let response: Response;
		try {
			response = await apiFetch(`${apiBase()}/api/auth/login`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', origin: mutationOrigin() },
				signal: AbortSignal.timeout(10000),
				body: JSON.stringify(input.data)
			});
		} catch {
			return fail(503, { error: 'API unreachable. Start it with pnpm dev:api.', email });
		}
		if (!response.ok) {
			const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 401;
			const error =
				status === 429
					? 'Too many attempts. Please retry later.'
					: status === 503
						? 'API unavailable. Please retry.'
						: 'Invalid credentials.';
			return fail(status, { error, email });
		}
		const result = sessionSchema.safeParse(await response.json().catch(() => null));
		if (
			!result.success ||
			!result.data.user ||
			!applySessionCookie(cookies, response.headers.getSetCookie())
		) {
			return fail(502, { error: 'Invalid API session response.', email });
		}
		throw redirect(303, result.data.user.role === 'admin' ? '/admin' : '/account');
	}
};
