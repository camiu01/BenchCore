/**
 * @file schema.ts
 * @brief Drizzle table definitions for accounts, content, sessions and recovery tokens.
 */
import { sql } from 'drizzle-orm';
import { boolean, customType, date, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** @brief PostgreSQL full-text vector, maintained exclusively by PostgreSQL. */
const tsvector = customType<{ data: string }>({
	/**
	 * @brief Identifies the native PostgreSQL column type.
	 * @return The SQL type name.
	 */
	dataType() { return 'tsvector'; }
});

/** @brief Binary media payload represented as a Node Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	/**
	 * @brief Identifies the native PostgreSQL column type.
	 * @return The SQL type name.
	 */
	dataType() { return 'bytea'; }
});

/**
 * @brief Post lifecycle states.
 */
export const postStatusEnum = pgEnum('post_status', ['draft', 'published', 'archived']);

/**
 * @brief A post lifecycle state.
 */
export type PostStatus = (typeof postStatusEnum.enumValues)[number];

/**
 * @brief Application users (admin authors for now, multi-user ready).
 */
export const users = pgTable('users', {
	id: uuid('id').primaryKey(),
	email: text('email').notNull().unique(),
	username: text('username').unique(),
	passwordHash: text('password_hash').notNull(),
	name: text('name').notNull(),
	role: text('role').notNull().default('reader'),
	isActive: boolean('is_active').notNull().default(true),
	sessionVersion: integer('session_version').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [uniqueIndex('users_email_normalized_idx').on(sql`lower(${t.email})`)]);

/**
 * @brief Blog posts. PostgreSQL is the runtime source of truth.
 */
export const posts = pgTable(
	'posts',
	{
		id: uuid('id').primaryKey(),
		slug: text('slug').notNull().unique(),
		title: text('title').notNull(),
		description: text('description').notNull().default(''),
		contentMarkdown: text('content_markdown').notNull(),
		contentHtml: text('content_html').notNull(),
		coverImage: text('cover_image'),
		category: text('category'),
		status: postStatusEnum('status').notNull().default('draft'),
		authorId: uuid('author_id').references(() => users.id),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		publishAt: timestamp('publish_at', { withTimezone: true }),
		searchVector: tsvector('search_vector').notNull().generatedAlwaysAs(
			sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(content_markdown, ''))`
		),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('posts_status_published_idx').on(t.status, t.publishedAt),
		index('posts_search_vector_idx').using('gin', t.searchVector),
		index('posts_publish_at_idx').on(t.publishAt).where(sql`${t.status} = 'draft'`)
	]
);

/**
 * @brief Database-backed media records and binary payloads.
 */
export const mediaBlobs = pgTable('media_blobs', {
	key: text('key').primaryKey(),
	filename: text('filename').notNull(),
	mime: text('mime').notNull(),
	sizeBytes: integer('size_bytes').notNull(),
	data: bytea('data').notNull()
});

/**
 * @brief Tags with unique slugs.
 */
export const tags = pgTable('tags', {
	id: uuid('id').primaryKey(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull().unique(),
	color: text('color').notNull().default('#64748B')
});

/**
 * @brief Many-to-many link between posts and tags.
 */
export const postTags = pgTable(
	'post_tags',
	{
		postId: uuid('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		tagId: uuid('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.postId, t.tagId] })]
);

/**
 * @brief Server-side sessions. Only the SHA-256 hash of the token is stored.
 */
export const sessions = pgTable('sessions', {
	id: uuid('id').primaryKey(),
	tokenHash: text('token_hash').notNull().unique(),
	userVersion: integer('user_version').notNull().default(0),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * @brief Single-use password recovery tokens. Only SHA-256 hashes are stored.
 */
export const passwordResetTokens = pgTable('password_reset_tokens', {
	id: uuid('id').primaryKey(),
	tokenHash: text('token_hash').notNull().unique(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [index('password_reset_user_idx').on(t.userId)]);

/**
 * @brief Comment moderation states.
 */
export const commentStatusEnum = pgEnum('comment_status', ['pending', 'approved', 'rejected']);

/**
 * @brief Comment moderation state.
 */
export type CommentStatus = (typeof commentStatusEnum.enumValues)[number];

/**
 * @brief Reader comments. Public reads see approved rows only.
 */
export const comments = pgTable(
	'comments',
	{
		id: uuid('id').primaryKey(),
		postId: uuid('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		authorName: text('author_name').notNull(),
		content: text('content').notNull(),
		status: commentStatusEnum('status').notNull().default('pending'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('comments_post_status_idx').on(t.postId, t.status)]
);

/**
 * @brief Anonymous post likes. One row per (post, voter hash).
 */
export const likes = pgTable(
	'likes',
	{
		postId: uuid('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		voterHash: text('voter_hash').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [primaryKey({ columns: [t.postId, t.voterHash] })]
);

/**
 * @brief Aggregate page views per post per day. No personal data stored.
 */
export const pageViews = pgTable(
	'page_views',
	{
		postId: uuid('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		day: date('day').notNull(),
		views: integer('views').notNull().default(1)
	},
	(t) => [primaryKey({ columns: [t.postId, t.day] })]
);

/**
 * @brief Newsletter subscribers with double opt-in tokens.
 */
export const subscribers = pgTable('subscribers', {
	id: uuid('id').primaryKey(),
	email: text('email').notNull().unique(),
	tokenHash: text('token_hash').notNull().unique(),
	confirmed: boolean('confirmed').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * @brief API token scopes.
 */
export const tokenScopeEnum = pgEnum('token_scope', ['read', 'admin']);

/**
 * @brief API token scope.
 */
export type TokenScope = (typeof tokenScopeEnum.enumValues)[number];

/**
 * @brief Public API tokens. Only SHA-256 hashes are stored.
 */
export const apiTokens = pgTable('api_tokens', {
	id: uuid('id').primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	tokenHash: text('token_hash').notNull().unique(),
	scope: tokenScopeEnum('scope').notNull().default('read'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	lastUsedAt: timestamp('last_used_at', { withTimezone: true })
});

/**
 * @brief Post revisions. A snapshot is stored before every update (capped).
 */
export const revisions = pgTable(
	'revisions',
	{
		id: uuid('id').primaryKey(),
		postId: uuid('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		contentMarkdown: text('content_markdown').notNull(),
		contentHtml: text('content_html').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('revisions_post_idx').on(t.postId)]
);

/**
 * @brief A user row.
 */
export type UserRow = typeof users.$inferSelect;

/**
 * @brief A post row.
 */
export type PostRow = typeof posts.$inferSelect;

/**
 * @brief A tag row.
 */
export type TagRow = typeof tags.$inferSelect;

/**
 * @brief A session row.
 */
export type SessionRow = typeof sessions.$inferSelect;

/**
 * @brief A password recovery token row.
 */
export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;

/**
 * @brief A comment row.
 */
export type CommentRow = typeof comments.$inferSelect;

/**
 * @brief A like row.
 */
export type LikeRow = typeof likes.$inferSelect;

/**
 * @brief A page-view row.
 */
export type PageViewRow = typeof pageViews.$inferSelect;

/**
 * @brief A subscriber row.
 */
export type SubscriberRow = typeof subscribers.$inferSelect;

/**
 * @brief An API token row.
 */
export type ApiTokenRow = typeof apiTokens.$inferSelect;

/**
 * @brief A revision row.
 */
export type RevisionRow = typeof revisions.$inferSelect;
