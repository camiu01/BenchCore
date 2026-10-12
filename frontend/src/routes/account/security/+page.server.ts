/**
 * @file +page.server.ts
 * @brief Session revocation and password-confirmed administrator TOTP settings.
 */
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { accountError, accountRequest } from '../../../lib/server/account-api.js';
import { enrollmentSchema, factorStatus } from '../../../lib/server/security-api.js';
import { createTotpQr } from '../../../lib/server/totp-qr.js';
import type { Actions, PageServerLoad } from './$types';

/** @brief Loads nonsecret factor state. @param event Session and request. @return Safe settings. */
export const load: PageServerLoad = async ({ locals, request }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	const factor =
		locals.user.role === 'admin' ? await factorStatus(request.headers.get('cookie')) : null;
	return { user: locals.user, factor };
};

const passwordSchema = z.object({ password: z.string().min(1).max(200) });
const codeSchema = passwordSchema.extend({ code: z.string().regex(/^\d{6}$/) });
const enableSchema = codeSchema.extend({ ticket: z.string().min(1).max(2048) });

export const actions: Actions = {
	/** @brief Revokes all device sessions. @param event Session and request. @return Redirect or safe failure. */
	logoutAll: async ({ locals, request, cookies }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}
		const result = await accountRequest(
			request.headers.get('cookie'),
			'/api/auth/logout/all',
			'POST'
		);
		if (result.status !== 200) {
			return fail(result.status, { error: accountError(result.status) });
		}
		cookies.delete('session', { path: '/' });
		throw redirect(303, '/login');
	},
	/** @brief Obtains a short-lived manual setup key after password confirmation. @param event Form. @return Enrollment or safe failure. */
	enroll: async ({ locals, request }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: accountError(403) });
		}
		const form = await request.formData();
		const parsed = passwordSchema.safeParse({ password: form.get('password') });
		if (!parsed.success) {
			return fail(400, { error: accountError(400) });
		}
		const result = await accountRequest(
			request.headers.get('cookie'),
			'/api/auth/totp/enroll',
			'POST',
			parsed.data
		);
		const enrollment = enrollmentSchema.safeParse(result.data);
		if (result.status !== 200 || !enrollment.success) {
			return fail(result.status === 200 ? 502 : result.status, {
				error: accountError(result.status)
			});
		}
		const { secret, ticket, uri } = enrollment.data;
		return { enrollment: { secret, ticket, qr: createTotpQr(uri) } };
	},
	/** @brief Confirms the authenticator and clears revoked session state. @param event Form. @return Redirect or safe failure. */
	enable: async ({ locals, request, cookies }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: accountError(403) });
		}
		const form = await request.formData();
		const parsed = enableSchema.safeParse({
			password: form.get('password'),
			code: form.get('code'),
			ticket: form.get('ticket')
		});
		if (!parsed.success) {
			return fail(400, { error: accountError(400) });
		}
		const result = await accountRequest(
			request.headers.get('cookie'),
			'/api/auth/totp/enable',
			'POST',
			parsed.data
		);
		if (result.status !== 200) {
			return fail(result.status, { error: accountError(result.status) });
		}
		cookies.delete('session', { path: '/' });
		throw redirect(303, '/login');
	},
	/** @brief Removes a factor only after password and fresh-code confirmation. @param event Form. @return Redirect or safe failure. */
	disable: async ({ locals, request, cookies }) => {
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: accountError(403) });
		}
		const form = await request.formData();
		const parsed = codeSchema.safeParse({ password: form.get('password'), code: form.get('code') });
		if (!parsed.success) {
			return fail(400, { error: accountError(400) });
		}
		const result = await accountRequest(
			request.headers.get('cookie'),
			'/api/auth/totp/disable',
			'POST',
			parsed.data
		);
		if (result.status !== 200) {
			return fail(result.status, { error: accountError(result.status) });
		}
		cookies.delete('session', { path: '/' });
		throw redirect(303, '/login');
	}
};
