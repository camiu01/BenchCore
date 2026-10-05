/**
 * @file graph-service.ts
 * @brief Public graph projection derived from published posts and wikilinks.
 */
import type { PostRepository, TagRepository } from '../db/repositories.js';
import { extractWikiLinks } from '../markdown/render.js';
import { canReadPost } from './audience.js';

/** @brief A graph tag with its persisted display color. */
export interface GraphTag {
	name: string;
	slug: string;
	color: string;
}

/** @brief A published graph node. */
export interface GraphNode {
	id: string;
	slug: string;
	title: string;
	description: string;
	publishedAt: string;
	tags: GraphTag[];
}

/** @brief A directed wikilink edge. */
export interface GraphEdge {
	source: string;
	target: string;
}

/**
 * @brief Builds a leak-free graph from currently public rows.
 * @param posts Post persistence.
 * @param tags Tag persistence.
 * @param now Visibility reference time.
 * @return Public nodes and deduplicated edges.
 */
export async function buildPublicGraph(posts: PostRepository, tags: TagRepository, now: Date = new Date()):
	Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
	const rows = await posts.listGraph(now);
	const tagRows = await tags.list();
	const byTag = new Map(tagRows.map((tag) => [tag.name, tag]));
	const visibleSlugs = new Set(rows.map((row) => row.slug));
	const edges = new Map<string, GraphEdge>();
	for (const row of rows) {
		if (!canReadPost(row.audience)) continue;
		for (const target of extractWikiLinks(row.contentMarkdown)) {
			if (target === row.slug || !visibleSlugs.has(target)) { continue; }
			edges.set(`${row.slug}\0${target}`, { source: row.slug, target });
		}
	}
	return {
		nodes: rows.map((row) => ({
			id: row.id,
			slug: row.slug,
			title: row.title,
			description: canReadPost(row.audience) ? row.description : '',
			publishedAt: row.publishedAt!.toISOString(),
			tags: row.tags.flatMap((name) => {
				const tag = byTag.get(name);
				return tag ? [{ name, slug: tag.slug, color: tag.color }] : [];
			})
		})),
		edges: [...edges.values()]
	};
}
