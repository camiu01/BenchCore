/**
 * @file admin-usability.test.ts
 * @brief Admin post discovery and explicit destructive-action safeguards.
 */
import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { adminPostCounts, filterAdminPosts } from '../src/lib/admin-posts.js';
import { blankValues } from '../src/lib/server/editor-values.js';
import Admin from '../src/routes/admin/+page.svelte';
import PostEditor from '../src/lib/components/PostEditor.svelte';
import PostDeleteConfirmation from '../src/lib/components/PostDeleteConfirmation.svelte';

const data: ComponentProps<typeof Admin>['data'] = {
	locale: 'en' as const,
	siteBase: 'https://example.test',
	sessionRole: 'admin',
	user: null,
	directUploads: false,
	schedulerEnabled: false,
	online: true,
	total: 2,
	page: 1,
	perPage: 25,
	totalPages: 1,
	search: '',
	status: 'all',
	counts: { all: 2, draft: 1, published: 1, archived: 0 },
	items: [
		{
			id: '11111111-1111-4111-8111-111111111111',
			slug: 'alpha-draft',
			title: 'Alpha',
			status: 'draft',
			tags: ['systems'],
			updatedAt: '2026-10-06T00:00:00Z'
		},
		{
			id: '22222222-2222-4222-8222-222222222222',
			slug: 'beta',
			title: 'Beta',
			status: 'published',
			tags: [],
			updatedAt: '2026-10-05T00:00:00Z'
		}
	]
};

describe('admin usability', () => {
	it('filters loaded posts by title, slug and publication status', () => {
		expect(filterAdminPosts(data.items, ' ALPHA ', 'all')).toEqual([data.items[0]]);
		expect(filterAdminPosts(data.items, 'draft', 'draft')).toEqual([data.items[0]]);
		expect(filterAdminPosts(data.items, '', 'published')).toEqual([data.items[1]]);
		expect(filterAdminPosts(data.items, 'alpha', 'published')).toEqual([]);
		expect(filterAdminPosts(data.items, '', 'all')).toEqual(data.items);
		expect(adminPostCounts(data.items)).toEqual({ all: 2, draft: 1, published: 1, archived: 0 });
		expect(adminPostCounts([])).toEqual({ all: 0, draft: 0, published: 0, archived: 0 });
	});

	it('renders post discovery controls, edit links and readable dates', () => {
		const { body } = render(Admin, { props: { data } });
		expect(body).toContain('Find a post');
		expect(body).toContain('aria-label="Post status"');
		expect(body).toContain('aria-current="page"');
		expect(body).toContain('6 October 2026');
		expect(body).toContain('aria-label="Edit Alpha"');
		expect(body).toContain('/admin/posts/new');
	});

	it('searches the full archive and keeps filters when paging', () => {
		const { body } = render(Admin, {
			props: { data: { ...data, total: 100, totalPages: 4, search: 'Alpha', status: 'draft' } }
		});
		expect(body).toContain('Search covers the entire archive');
		expect(body).toContain('search=Alpha&amp;status=draft&amp;page=2');
		expect(body).not.toContain('loaded posts');
	});

	it('keeps selection labels out of the action row without losing accessible names or form ownership', () => {
		const { body } = render(Admin, { props: { data } });
		expect(body).toContain('class="admin-post-content"');
		const selections = [
			...body.matchAll(/<label class="admin-post-selection">([\s\S]*?)<\/label>/g)
		];
		expect(selections).toHaveLength(data.items.length);
		for (const [index, selection] of selections.entries()) {
			expect(selection[1]).toContain('type="checkbox"');
			expect(selection[1]).toContain('form="bulk-delete"');
			expect(selection[1]).toContain(`aria-label="Select ${data.items[index]?.title}"`);
			expect(selection[1]?.replace(/<[^>]*>/g, '').trim()).toBe('');
		}
		const actions = [...body.matchAll(/<div class="admin-post-actions">([\s\S]*?)<\/div>/g)];
		expect(actions).toHaveLength(data.items.length);
		for (const action of actions) {
			expect(action[1]).not.toContain('checkbox');
			expect(action[1]).toContain('class="stamp');
			expect(action[1]).toContain('class="btn"');
		}
	});

	it('does not render a destructive submit button before confirmation', () => {
		const { body } = render(PostEditor, {
			props: {
				values: blankValues(),
				isNew: false,
				previewHtml: null,
				uploadedUrl: null,
				errorMsg: 'Example error'
			}
		});
		expect(body).toContain('Delete post');
		expect(body).toContain('aria-expanded="false"');
		expect(body).not.toContain('formaction="?/delete"');
		expect(body).toContain('role="alert"');
		expect(body).toContain('aria-describedby="slug-help"');
	});

	it('offers permanent deletion only in the confirmation panel and keeps cancellation available', () => {
		const { body } = render(PostDeleteConfirmation, {
			props: { title: 'Alpha', disabled: false, oncancel: () => undefined }
		});
		expect(body).toContain('cannot be undone');
		expect(body).toContain('formaction="?/delete"');
		expect(body).toContain('Yes, delete permanently');
		expect(body).toContain('Keep post');
	});
});
