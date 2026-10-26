/**
 * @file posts.ts
 * @brief Published discovery, protected editorial operations and engagement contracts.
 */
import { z } from 'zod';
import { createPostSchema, updatePostSchema } from '../../src/posts/post-service.js';
import { publishedQuerySchema } from '../../src/posts/list-query.js';
import { adminPageSchema } from '../../src/posts/admin-query.js';
import { commentSchema, moderationSchema } from '../../src/posts/engagement-service.js';
import { input, operation, path, query, type Paths } from './helpers.js';
import { color, text, uuid } from './schemas.js';

export const postSchemas = {
	CreatePost: input(createPostSchema),
	UpdatePost: input(updatePostSchema),
	CommentInput: input(commentSchema),
	Moderation: input(moderationSchema),
	TagColor: input(z.object({ color }).strict()),
	RenderInput: input(z.object({ markdown: text.max(200000) })),
	BulkDelete: input(
		z
			.object({
				ids: z.array(uuid).min(1).max(100),
				confirmation: z.literal('DELETE')
			})
			.strict()
	)
};
const tag = 'Posts';
const publicPost = path(
	'post',
	{ type: 'string' },
	'Published slug for GET. Unpublished, missing and invalid slugs return the same 404.'
);
const postId = path('post', input(uuid), 'Database UUID for mutations, not the public slug.');
const id = path('id', input(uuid), 'Database resource UUID.');
const slug = path('slug', { type: 'string' }, 'Published post slug.');
const offset = query(
	'offset',
	{ type: 'integer', minimum: 0, maximum: 2147483647, default: 0 },
	'Decimal integer. Batches contain at most 100; increase offset by 100 when hasMore is true.'
);
const publicFields = publishedQuerySchema.shape;
const archiveQuery = [
	query('limit', input(publicFields.limit), 'Maximum page size.'),
	query('offset', input(publicFields.offset), 'Offset into the filtered page.'),
	query(
		'search',
		input(publicFields.search),
		'PostgreSQL full-text search; not a fuzzy or substring search.'
	),
	query(
		'category',
		input(publicFields.category),
		'Exact main category, combined with search and tags.'
	),
	query(
		'tag',
		input(publicFields.tags),
		'Repeated tag names. Both tag and tags contribute to the combined maximum of 20 before deduplication.'
	),
	query(
		'tags',
		input(publicFields.tags),
		'Alias for repeated tag; encoded with repeated query keys, not CSV.'
	),
	query('tagMode', input(publicFields.tagMode), 'AND/OR across selected tags.'),
	query(
		'sort',
		input(publicFields.sort),
		'Descending order. Restricted likes do not affect guest ranking.'
	)
];
const adminQuery = Object.entries(adminPageSchema.shape).map(([name, schema]) =>
	query(
		name,
		input(schema),
		'Protected ledger filter; counts cover search matches before the status filter.'
	)
);
export const postPaths: Paths = {
	'/api/posts': {
		get: operation({
			id: 'listPosts',
			summary: 'Search published posts',
			tag,
			access: 'viewer',
			parameters: archiveQuery,
			result: 'PostPage',
			errors: [400],
			description:
				'Published-only results and filtered total. Guests retain locked titles but receive empty descriptions and zero likes. Responses are private/no-store and vary by Cookie.'
		}),
		post: operation({
			id: 'createPost',
			summary: 'Create a post',
			tag,
			access: 'admin',
			mutates: true,
			body: 'CreatePost',
			result: 'Post',
			status: 201,
			errors: [409],
			description:
				'Title, slug and Markdown are required. Scheduled posts must remain drafts. JSON has a 256 KiB byte cap, independent of character limits. Duplicate slugs return 409.'
		})
	},
	'/api/posts/{post}': {
		get: operation({
			id: 'getPost',
			summary: 'Read a published post by slug',
			tag,
			access: 'viewer',
			parameters: [publicPost],
			result: 'PostDetail',
			errors: [404],
			description:
				'GET uses a slug, unlike PUT/DELETE. Locked guest DTOs redact body, description, cover and backlinks. Missing/unpublished returns the same 404; private/no-store, Vary: Cookie.'
		}),
		put: operation({
			id: 'updatePost',
			summary: 'Update selected fields by UUID',
			tag,
			access: 'admin',
			mutates: true,
			parameters: [postId],
			body: 'UpdatePost',
			result: 'Post',
			errors: [404, 409],
			description:
				'Despite PUT, accepts a partial field set. Omitted fields are retained; only nullable fields accept null. A scheduled post must stay draft. No revision restore is promised.'
		}),
		delete: operation({
			id: 'deletePost',
			summary: 'Delete a post by UUID',
			tag,
			access: 'admin',
			mutates: true,
			parameters: [postId],
			status: 204,
			errors: [404],
			description:
				'Permanent audited deletion; clients must confirm first. Does not guarantee media cleanup. No revision recovery endpoint exists.'
		})
	},
	'/api/posts/{slug}/preview': {
		get: operation({
			id: 'previewPost',
			summary: 'Read safe preview metadata',
			tag,
			access: 'viewer',
			parameters: [slug],
			result: 'PostPreview',
			errors: [404],
			description:
				'No post body. Locked guest summaries are empty and covers null. Missing/unpublished share 404; private/no-store, Vary: Cookie.'
		})
	},
	'/api/tags': {
		get: operation({
			id: 'listTags',
			summary: 'List tags with published post counts',
			tag,
			result: 'Tags'
		})
	},
	'/api/graph': {
		get: operation({
			id: 'getGraph',
			summary: 'Read the published knowledge graph',
			tag,
			result: 'Graph',
			description:
				'Published node metadata and slug-to-slug edges. Reader-only descriptions/outgoing wikilinks are withheld. Shared tags above 24 posts form hubs instead of quadratic meshes.'
		})
	},
	'/api/render': {
		post: operation({
			id: 'renderMarkdown',
			summary: 'Preview sanitized Markdown without saving',
			tag,
			access: 'admin',
			mutates: true,
			body: 'RenderInput',
			result: 'Rendered'
		})
	},
	'/api/admin/posts': {
		get: operation({
			id: 'listAdminPosts',
			summary: 'Search all editorial states',
			tag: 'Administration',
			access: 'admin',
			parameters: adminQuery,
			result: 'AdminPostPage',
			errors: [400]
		})
	},
	'/api/admin/posts/{id}': {
		get: operation({
			id: 'getAdminPost',
			summary: 'Read an editable post',
			tag: 'Administration',
			access: 'admin',
			parameters: [id],
			result: 'AdminPost',
			errors: [404]
		})
	},
	'/api/admin/posts/suggestions': {
		get: operation({
			id: 'suggestPosts',
			summary: 'Read up to 200 recently updated wikilink candidates',
			tag: 'Administration',
			access: 'admin',
			result: 'PostSuggestions'
		})
	},
	'/api/admin/posts/delete': {
		post: operation({
			id: 'deleteSelectedPosts',
			summary: 'Delete a confirmed bounded selection',
			tag: 'Administration',
			access: 'admin',
			mutates: true,
			body: 'BulkDelete',
			result: 'Deleted',
			description:
				'Requires confirmation DELETE and 1–100 UUIDs. Deduplicates IDs and deletes with a transactional audit record. Permanent; no undo.'
		})
	},
	'/api/admin/tags': {
		get: operation({
			id: 'listAdminTags',
			summary: 'Read the full tag registry',
			tag: 'Administration',
			access: 'admin',
			result: 'AdminTags'
		})
	},
	'/api/admin/tags/{id}': {
		patch: operation({
			id: 'changeTagColor',
			summary: 'Set a tag HEX color',
			tag: 'Administration',
			access: 'admin',
			mutates: true,
			parameters: [id],
			body: 'TagColor',
			result: 'Tag',
			errors: [404]
		}),
		delete: operation({
			id: 'deleteTag',
			summary: 'Delete a tag and all its associations',
			tag: 'Administration',
			access: 'admin',
			mutates: true,
			parameters: [id],
			status: 204,
			errors: [404],
			description: 'Permanent tag deletion. Does not delete posts.'
		})
	},
	'/api/posts/{slug}/comments': {
		get: operation({
			id: 'listComments',
			summary: 'Read approved comments',
			tag: 'Engagement',
			access: 'viewer',
			parameters: [slug, offset],
			result: 'Comments',
			errors: [400, 401, 404]
		}),
		post: operation({
			id: 'submitComment',
			summary: 'Submit a comment for moderation',
			tag: 'Engagement',
			access: 'viewer',
			mutates: true,
			parameters: [slug],
			body: 'CommentInput',
			result: 'CommentAccepted',
			status: 202,
			errors: [401, 404],
			description:
				'Plain text; pending until approved. Leave honeypot website empty. Generic acceptance also covers honeypot submissions; per-IP/session quotas apply. Reader-only posts require a reader/admin session.'
		})
	},
	'/api/posts/{slug}/likes': {
		get: operation({
			id: 'getLikes',
			summary: 'Read like count and browser state',
			tag: 'Engagement',
			access: 'viewer',
			parameters: [slug],
			result: 'Likes',
			errors: [401, 404]
		}),
		post: operation({
			id: 'toggleLike',
			summary: 'Toggle a browser like',
			tag: 'Engagement',
			access: 'viewer',
			mutates: true,
			parameters: [slug],
			result: 'Likes',
			errors: [401, 404],
			cookie: true,
			description:
				'Creates an anonymous like_voter cookie if needed; toggling is not idempotent. Reader-only posts require a reader/admin session. Counts are not page analytics.'
		})
	},
	'/api/admin/comments': {
		get: operation({
			id: 'listModerationComments',
			summary: 'Read the moderation queue',
			tag: 'Engagement',
			access: 'admin',
			parameters: [
				offset,
				query('status', input(moderationSchema.shape.status), 'Optional moderation status.')
			],
			result: 'ModerationPage',
			errors: [400]
		})
	},
	'/api/admin/comments/{id}': {
		patch: operation({
			id: 'moderateComment',
			summary: 'Change comment status',
			tag: 'Engagement',
			access: 'admin',
			mutates: true,
			parameters: [id],
			body: 'Moderation',
			result: 'ModeratedComment',
			errors: [404]
		}),
		delete: operation({
			id: 'deleteComment',
			summary: 'Permanently delete a comment',
			tag: 'Engagement',
			access: 'admin',
			mutates: true,
			parameters: [id],
			status: 204,
			errors: [404]
		})
	},
	'/api/admin/audit': {
		get: operation({
			id: 'listAuditEvents',
			summary: 'Read identifier-only security history',
			tag: 'Administration',
			access: 'admin',
			parameters: [
				query(
					'offset',
					{ type: 'integer', minimum: 0, maximum: 100000, default: 0 },
					'At most 50 events per batch, newest first.'
				)
			],
			result: 'AuditPage',
			errors: [400],
			description:
				'Contains identifiers, action, count and time, never credentials, emails, IP addresses or content bodies.'
		})
	}
};
