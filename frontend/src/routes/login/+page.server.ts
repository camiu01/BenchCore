/**
 * Login page: redirects authenticated users, forwards credentials to the API.
 */
import { fail, redirect, type Cookies } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { apiBase } from '../../lib/api.js';

/**
 * @brief Redirects authenticated visitors to the dashboard.
 */
export const load: PageServerLoad = ({ locals }) => {
	if (locals.user !== null) {
		throw redirect(303, '/admin');
	}
	return {};
};

/**
 * @brief Applies upstream Set-Cookie headers to the browser response.
 * @param cookies The SvelteKit cookie jar.
 * @param headers The upstream Set-Cookie values.
 */
function applySetCookies(cookies: Cookies, headers: string[]): void {
	for (const entry of headers) {
		const segments = entry.split(';').map((part) => part.trim());
		const pair = segments[0] ?? '';
		const separator = pair.indexOf('=');
		if (separator === -1) {
			continue;
		}
		const name = pair.slice(0, separator);
		const value = decodeURIComponent(pair.slice(separator + 1));
		let sameSite: 'lax' | 'strict' | 'none' = 'lax';
		let secure = false;
		let maxAge: number | undefined = undefined;
		for (const attribute of segments.slice(1)) {
			const [rawKey, rawValue] = attribute.split('=');
			const key = (rawKey ?? '').trim().toLowerCase();
			if (key === 'max-age' && rawValue !== undefined && Number.isInteger(Number(rawValue))) {
				maxAge = Number(rawValue);
			}
			if (key === 'secure') {
				secure = true;
			}
			if (key === 'samesite' && rawValue !== undefined) {
				const mode = rawValue.trim().toLowerCase();
				sameSite = mode === 'strict' ? 'strict' : mode === 'none' ? 'none' : 'lax';
			}
		}
		const base = { path: '/', httpOnly: true, sameSite, secure } as const;
		if (maxAge === undefined) {
			cookies.set(name, value, { ...base });
		} else {
			cookies.set(name, value, { ...base, maxAge });
		}
	}
}

export const actions: Actions = {
	/**
	 * @brief Authenticates against the API and stores the session cookie.
	 */
	login: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		let response: Response;
		try {
			response = await fetch(`${apiBase()}/api/auth/login`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
		} catch {
			return fail(503, { error: 'API unreachable. Start it with pnpm dev:api.', email });
		}
		if (!response.ok) {
			return fail(401, { error: 'Invalid credentials.', email });
		}
		applySetCookies(cookies, response.headers.getSetCookie());
		throw redirect(303, '/admin');
	}
};
