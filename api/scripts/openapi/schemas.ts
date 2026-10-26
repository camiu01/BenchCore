/**
 * @file schemas.ts
 * @brief HTTP response models and reusable wire scalars for OpenAPI generation.
 */
import { z } from 'zod';
import { input } from './helpers.js';

export const uuid = z.uuid();
export const date = z.iso.datetime({ offset: true });
export const nullableDate = date.nullable();
export const text = z.string();
export const count = z.number().int().nonnegative();
export const status = z.enum(['draft', 'published', 'archived']);
export const audience = z.enum(['public', 'readers']);
export const color = z.string().regex(/^#[A-Fa-f0-9]{6}$/);
export const postLink = z.object({ slug: text, title: text });
export const tag = z.object({ id: uuid, name: text, slug: text, color });
export const user = z.object({
	id: uuid,
	email: z.email(),
	username: text.nullable(),
	name: text,
	role: z.enum(['admin', 'reader']),
	isActive: z.boolean(),
	createdAt: date
});
export const post = z.object({
	id: uuid,
	slug: text,
	title: text,
	description: text,
	tags: z.array(text),
	category: text.nullable(),
	authorName: text.nullable(),
	publishedAt: nullableDate,
	updatedAt: date,
	likesCount: count,
	audience,
	locked: z.boolean()
});
export const adminPost = post.omit({ likesCount: true, locked: true }).extend({
	status,
	publishAt: nullableDate
});
export const comment = z.object({
	id: uuid,
	authorName: text,
	content: text,
	createdAt: date
});
export const moderatedComment = comment.extend({
	postId: uuid,
	status: z.enum(['pending', 'approved', 'rejected'])
});
export const stats = z.object({
	queued: count,
	sending: count,
	sent: count,
	failed: count,
	skipped: count
});
export const campaign = z.object({
	id: uuid,
	subject: text,
	body: text,
	status: z.enum(['draft', 'sending', 'complete']),
	authorId: uuid,
	createdAt: date
});

/** @brief Builds an items wrapper with optional pagination data. @param item Item validator. @param paginated Whether total is present. @return Wire validator. */
export function items(item: z.ZodType, paginated = false) {
	return paginated
		? z.object({ items: z.array(item), total: count })
		: z.object({ items: z.array(item) });
}

export const responseSchemas = {
	Error: input(
		z.object({
			error: text,
			message: text.optional(),
			issues: z.array(text).optional()
		})
	),
	Ok: input(z.object({ ok: z.literal(true) })),
	CommentAccepted: input(z.object({ ok: z.literal(true), message: text })),
	Accepted: input(z.object({ accepted: z.boolean() })),
	Availability: input(z.object({ enabled: z.boolean() })),
	User: input(user),
	UserResult: input(z.object({ user })),
	UserPage: input(items(user, true)),
	Post: input(post),
	PostPage: input(items(post, true)),
	PostDetail: input(
		post.extend({
			contentHtml: text,
			coverImage: text.nullable(),
			readingMinutes: count,
			backlinks: z.array(postLink)
		})
	),
	PostPreview: input(
		z.object({
			slug: text,
			title: text,
			description: text,
			tags: z.array(text),
			publishedAt: nullableDate,
			coverImage: text.nullable(),
			locked: z.boolean()
		})
	),
	AdminPost: input(
		adminPost.extend({
			contentMarkdown: text,
			contentHtml: text,
			coverImage: text.nullable()
		})
	),
	AdminPostPage: input(
		items(adminPost, true).extend({
			counts: z.object({
				all: count,
				draft: count,
				published: count,
				archived: count
			})
		})
	),
	PostSuggestions: input(
		items(z.object({ id: uuid, slug: text, title: text, tags: z.array(text) }))
	),
	Tags: input(items(tag.omit({ id: true }).extend({ count }))),
	AdminTags: input(items(tag.extend({ count }))),
	Tag: input(tag),
	Categories: input(items(z.object({ name: text, count }))),
	Changed: input(z.object({ changed: count })),
	Deleted: input(z.object({ count })),
	Rendered: input(z.object({ html: text })),
	Comments: input(items(comment).extend({ hasMore: z.boolean() })),
	ModeratedComment: input(moderatedComment),
	ModerationPage: input(
		items(moderatedComment.extend({ post: postLink.nullable() })).extend({
			hasMore: z.boolean()
		})
	),
	Likes: input(z.object({ count, liked: z.boolean() })),
	FactorStatus: input(z.object({ enabled: z.boolean(), available: z.boolean() })),
	Enrollment: input(z.object({ secret: text, ticket: text, uri: text })),
	Graph: input(
		z.object({
			nodes: z.array(
				z.object({
					id: uuid,
					slug: text,
					title: text,
					description: text,
					publishedAt: date,
					tags: z.array(tag.omit({ id: true }))
				})
			),
			edges: z.array(z.object({ source: text, target: text }))
		})
	),
	AuditPage: input(
		items(
			z.object({
				id: uuid,
				action: z.enum([
					'user.created',
					'user.changed',
					'password.changed',
					'password.reset',
					'sessions.revoked',
					'totp.enabled',
					'totp.disabled',
					'posts.deleted',
					'comment.moderated',
					'comment.deleted'
				]),
				actorId: uuid.nullable(),
				targetId: uuid.nullable(),
				count,
				createdAt: date
			})
		).extend({ hasMore: z.boolean() })
	),
	Campaign: input(campaign),
	NewsletterStats: input(stats),
	NewsletterDashboard: input(
		items(campaign.extend({ stats })).extend({
			confirmed: count,
			enabled: z.boolean()
		})
	),
	VaultResult: input(
		z.object({
			created: z.array(text),
			skipped: z.array(text),
			errors: z.array(z.object({ file: text, message: text })),
			warnings: z.array(z.object({ file: text, message: text }))
		})
	)
};
