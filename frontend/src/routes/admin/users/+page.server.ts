/**
 * @file +page.server.ts
 * @brief Administrator account listing, creation and safe role/activation changes.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { accountError, accountRequest, listAccounts } from '../../../lib/server/account-api.js';
import { serverT } from '../../../lib/server/server-t.js';
import type { Actions, PageServerLoad } from './$types';

/** @brief Loads a bounded user ledger. @param event Session and query. @return Page. */
export const load: PageServerLoad = async ({ request, url, locals }) => {
	if (locals.user?.role !== 'admin') {
		throw error(403, serverT('admin.error.adminRequired'));
	}
	const offset = z.coerce
		.number()
		.int()
		.min(0)
		.max(100_000)
		.safeParse(url.searchParams.get('offset') ?? 0);
	if (!offset.success) {
		throw error(400, serverT('admin.error.invalidPage'));
	}
	const page = await listAccounts(request.headers.get('cookie'), offset.data);
	return {
		items: page?.items ?? [],
		total: page?.total ?? 0,
		online: page !== null,
		offset: offset.data
	};
};

export const actions: Actions = {
	/** @brief Creates an explicit managed identity. @param event Form and administrator. @return Feedback or redirect. */
	create: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			throw error(403, serverT('admin.error.adminRequired'));
		}
		const form = await request.formData();
		const parsed = z
			.object({
				username: z
					.string()
					.trim()
					.regex(/^[a-z][a-z0-9_-]{2,31}$/i),
				email: z.email().max(254),
				name: z.string().trim().min(1).max(200),
				password: z.string().min(8).max(200),
				role: z.enum(['admin', 'reader'])
			})
			.safeParse(
				Object.fromEntries(
					['username', 'email', 'name', 'password', 'role'].map((key) => [key, form.get(key)])
				)
			);
		if (!parsed.success) {
			return fail(400, { error: serverT('admin.error.invalidIdentity') });
		}
		const result = await accountRequest(
			request.headers.get('cookie'),
			'/api/admin/users',
			'POST',
			parsed.data
		);
		if (result.status !== 201) {
			return fail(result.status, { error: accountError(result.status) });
		}
		throw redirect(303, '/admin/users');
	},
	/** @brief Changes role/activation without allowing password resets or last-admin removal. @param event Form. @return Feedback or redirect. */
	update: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') {
			throw error(403, serverT('admin.error.adminRequired'));
		}
		const form = await request.formData();
		const parsed = z
			.object({
				id: z.uuid(),
				role: z.enum(['admin', 'reader']),
				isActive: z.enum(['true', 'false'])
			})
			.safeParse({ id: form.get('id'), role: form.get('role'), isActive: form.get('isActive') });
		if (!parsed.success) {
			return fail(400, { error: serverT('admin.error.invalidAccountState') });
		}
		const result = await accountRequest(
			request.headers.get('cookie'),
			`/api/admin/users/${parsed.data.id}`,
			'PATCH',
			{
				role: parsed.data.role,
				isActive: parsed.data.isActive === 'true'
			}
		);
		if (result.status !== 200) {
			return fail(result.status, { error: accountError(result.status) });
		}
		throw redirect(303, '/admin/users');
	}
};
