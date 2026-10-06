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
	siteBase: 'https://example.test',
	sessionRole: 'admin',
	user: null,
	directUploads: false,
	schedulerEnabled: false,
	online: true,
	total: 2,
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
		expect(body).toContain('aria-pressed="true"');
		expect(body).toContain('6 October 2026');
		expect(body).toContain('aria-label="Edit Alpha"');
		expect(body).toContain('/admin/posts/new');
	});

	it('describes the scope of local filters when the archive has more posts', () => {
		const { body } = render(Admin, { props: { data: { ...data, total: 100 } } });
		expect(body).toContain('not all 100 posts');
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
