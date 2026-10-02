/**
 * @file post-service.ts
 * @brief Post use-cases over repository contracts. Single home for post rules.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PostRepository, PostWithTags, TagRepository, UserRepository } from '../db/repositories.js';
import type { PostRow, PostStatus } from '../db/schema.js';
import { renderMarkdown } from '../markdown/render.js';
import { flattenIssues, slugField } from '../markdown/schema.js';
import { canTransition, isPublic, normalizeSlug } from './publishing.js';

/**
 * @brief Domain error with a machine-readable code.
 */
export class PostError extends Error {
	code: 'not_found' | 'validation' | 'transition' | 'conflict';

	/**
	 * @brief Builds a post domain error.
	 * @param code The error code.
	 * @param message The human-readable message.
	 */
	constructor(code: PostError['code'], message: string) {
		super(message);
		this.code = code;
	}
}

/**
 * @brief Repository set required by the post service.
 */
export interface PostServiceDeps {
	posts: PostRepository;
	tags: TagRepository;
	users: UserRepository;
}

/**
 * @brief Validated input for creating a post.
 */
export const createPostSchema = z.object({
	title: z.string().min(1).max(200),
	slug: slugField,
	description: z.string().max(500).default(''),
	status: z.enum(['draft', 'published', 'archived']).default('draft'),
	tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
	publishedAt: z.iso.datetime({ offset: true }).nullable().optional(),
	publishAt: z.iso.datetime({ offset: true }).nullable().optional(),
	contentMarkdown: z.string().min(1).max(200_000),
	coverImage: z.string().max(500).nullable().optional()
});

/**
 * @brief Validated input for patching a post.
 */
export const updatePostSchema = createPostSchema.partial();

/**
 * @brief A public list item DTO.
 */
export interface PostListItem {
	id: string;
	slug: string;
	title: string;
	description: string;
	tags: string[];
	authorName: string | null;
	publishedAt: string | null;
}

/**
 * @brief A public detail DTO with backlinks.
 */
export interface PostDetail extends PostListItem {
	contentHtml: string;
	coverImage: string | null;
	readingMinutes: number;
	backlinks: { slug: string; title: string }[];
}

/**
 * @brief Parses unknown input through a schema or throws a validation error.
 * @param schema The Zod schema.
 * @param input The untrusted input.
 * @return The parsed value.
 */
function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		throw new PostError('validation', flattenIssues(parsed.error).join('; '));
	}
	return parsed.data;
}

/**
 * @brief Resolves an author name for a post row.
 * @param users The user repository.
 * @param authorId The author id, if any.
 * @return The author name or null.
 */
async function resolveAuthorName(users: UserRepository, authorId: string | null): Promise<string | null> {
	if (authorId === null) {
		return null;
	}
	const user = await users.findById(authorId);
	return user?.name ?? null;
}

/**
 * @brief Finds posts linking to a slug (Obsidian-style backlinks).
 * @param deps The repositories.
 * @param slug The target slug.
 * @param now The reference time.
 * @return The linking published posts.
 */
async function findBacklinks(
	deps: PostServiceDeps,
	slug: string,
	now: Date
): Promise<{ slug: string; title: string }[]> {
	const all = await deps.posts.listAll();
	const pattern = new RegExp(`\\[\\[\\s*${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:\\|[^\\]]+)?\\]\\]`, 'i');
	return all
		.filter((row) => row.slug !== slug && isPublic(row.status, row.publishedAt, now) && pattern.test(row.contentMarkdown))
		.map((row) => ({ slug: row.slug, title: row.title }));
}

/**
 * @brief Maps a row with tags to a public list item.
 * @param deps The repositories.
 * @param row The row with tags.
 * @return The list item DTO.
 */
async function toListItem(deps: PostServiceDeps, row: PostWithTags): Promise<PostListItem> {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		description: row.description,
		tags: row.tags,
		authorName: await resolveAuthorName(deps.users, row.authorId),
		publishedAt: row.publishedAt?.toISOString() ?? null
	};
}

/**
 * @brief Lists published posts with pagination.
 * @param deps The repositories.
 * @param options Page bounds, optional tag filter and reference time.
 * @return The page items plus the total count.
 */
export async function listPublishedPosts(
	deps: PostServiceDeps,
	options: { limit?: number | undefined; offset?: number | undefined; tag?: string | undefined;
		search?: string | undefined; now?: Date | undefined } = {}
): Promise<{ items: PostListItem[]; total: number }> {
	const limit = Math.min(Math.max(options.limit ?? 10, 1), 200);
	const offset = Math.max(options.offset ?? 0, 0);
	const now = options.now ?? new Date();
	const page = await deps.posts.listPublished({ limit, offset, tag: options.tag, search: options.search, now });
	const items: PostListItem[] = [];
	for (const row of page.items) {
		items.push(await toListItem(deps, row));
	}
	return { items, total: page.total };
}

/**
 * @brief Loads one published post by slug. Drafts mask as not found.
 * @param deps The repositories.
 * @param slug The post slug.
 * @param now The reference time.
 * @return The detail DTO or null.
 */
export async function getPublishedPost(
	deps: PostServiceDeps,
	slug: string,
	now: Date = new Date()
): Promise<PostDetail | null> {
	const row = await deps.posts.findBySlug(normalizeSlug(slug));
	if (row === null || !isPublic(row.status, row.publishedAt, now)) {
		return null;
	}
	const item = await toListItem(deps, { ...row, tags: await deps.tags.getPostTagNames(row.id) });
	const rendered = await renderMarkdown(row.contentMarkdown, { mediaPrefix: '/api/media' });
	return {
		...item,
		contentHtml: rendered.html,
		coverImage: row.coverImage,
		readingMinutes: rendered.readingMinutes,
		backlinks: await findBacklinks(deps, row.slug, now)
	};
}

/**
 * @brief Creates a post, rendering Markdown and linking tags.
 * @param deps The repositories.
 * @param input The untrusted create payload.
 * @param authorId The author id, if any.
 * @param knownSlugs Optional slug set marking broken wikilinks.
 * @return The created list item.
 */
export async function createPost(
	deps: PostServiceDeps,
	input: unknown,
	authorId?: string | undefined,
	knownSlugs?: Set<string> | undefined
): Promise<PostListItem> {
	const parsed = parseOrThrow(createPostSchema, input);
	const slug = normalizeSlug(parsed.slug);
	const existing = await deps.posts.findBySlug(slug);
	if (existing !== null) {
		throw new PostError('conflict', `slug already exists: ${slug}`);
	}
	const dates = publishingDates(parsed, null);
	const rendered = await renderMarkdown(parsed.contentMarkdown, { knownSlugs, mediaPrefix: '/api/media' });
	const row = await deps.posts.create({
		id: randomUUID(),
		slug,
		title: parsed.title,
		description: parsed.description,
		contentMarkdown: parsed.contentMarkdown,
		contentHtml: rendered.html,
		coverImage: parsed.coverImage ?? null,
		authorId: authorId ?? null,
		...dates
	});
	const tagRows = await deps.tags.upsertByName(parsed.tags);
	await deps.tags.setPostTags(
		row.id,
		tagRows.map((tag) => tag.id)
	);
	return toListItem(deps, { ...row, tags: await deps.tags.getPostTagNames(row.id) });
}

/**
 * @brief Patches a post, enforcing legal status transitions.
 * @param deps The repositories.
 * @param id The post id.
 * @param input The untrusted patch payload.
 * @return The updated list item.
 */
export async function updatePost(
	deps: PostServiceDeps,
	id: string,
	input: unknown
): Promise<PostListItem> {
	const parsed = parseOrThrow(updatePostSchema, input);
	const row = await deps.posts.findById(id);
	if (row === null) {
		throw new PostError('not_found', `post not found: ${id}`);
	}
	const patch = await buildUpdatePatch(deps, row, parsed);
	const updated = await deps.posts.update(id, patch);
	if (updated === null) {
		throw new PostError('not_found', `post not found: ${id}`);
	}
	if (parsed.tags !== undefined) {
		const tagRows = await deps.tags.upsertByName(parsed.tags);
		await deps.tags.setPostTags(
			id,
			tagRows.map((tag) => tag.id)
		);
	}
	return toListItem(deps, { ...updated, tags: await deps.tags.getPostTagNames(id) });
}

/**
 * @brief Resolves publication dates and enforces draft-only scheduling.
 * @param input Validated publication fields.
 * @param row Previous row, if any.
 * @return Status and publication dates.
 */
function publishingDates(input: z.output<typeof updatePostSchema>, row: PostRow | null): {
	status: PostStatus; publishedAt: Date | null; publishAt: Date | null;
} {
	const status = input.status ?? row?.status ?? 'draft';
	const publishAt = input.publishAt === undefined ? row?.publishAt ?? null
		: input.publishAt === null ? null : new Date(input.publishAt);
	if (publishAt && status !== 'draft') {
		throw new PostError('validation', 'scheduled posts must remain drafts until the job publishes them');
	}
	let publishedAt = input.publishedAt === undefined ? row?.publishedAt ?? null
		: input.publishedAt === null ? null : new Date(input.publishedAt);
	if (status === 'published' && publishedAt === null) { publishedAt = new Date(); }
	return { status, publishedAt, publishAt };
}

/**
 * @brief Builds a validated post patch without duplicating publication rules.
 * @param deps Repositories.
 * @param row Existing post.
 * @param parsed Validated update.
 * @return Persistence patch.
 */
async function buildUpdatePatch(deps: PostServiceDeps, row: PostRow,
	parsed: z.output<typeof updatePostSchema>): Promise<Partial<PostRow>> {
	if (parsed.status !== undefined && !canTransition(row.status, parsed.status)) {
		throw new PostError('transition', `illegal transition ${row.status} -> ${parsed.status}`);
	}
	const slug = parsed.slug === undefined ? row.slug : normalizeSlug(parsed.slug);
	const clash = await deps.posts.findBySlug(slug);
	if (clash !== null && clash.id !== row.id) { throw new PostError('conflict', `slug already exists: ${slug}`); }
	const rendered = parsed.contentMarkdown === undefined ? null
		: await renderMarkdown(parsed.contentMarkdown, { mediaPrefix: '/api/media' });
	return {
		title: parsed.title ?? row.title, slug, description: parsed.description ?? row.description,
		contentMarkdown: parsed.contentMarkdown ?? row.contentMarkdown,
		contentHtml: rendered?.html ?? row.contentHtml,
		coverImage: parsed.coverImage === undefined ? row.coverImage : parsed.coverImage,
		...publishingDates(parsed, row)
	};
}

/**
 * @brief Deletes a post.
 * @param deps The repositories.
 * @param id The post id.
 * @return True when a row was deleted.
 */
export async function deletePost(deps: PostServiceDeps, id: string): Promise<boolean> {
	return deps.posts.remove(id);
}
