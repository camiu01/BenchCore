/**
 * @file graph-service.ts
 * @brief Public graph projection derived from published posts, tags and wikilinks.
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

/** @brief A connection from a wikilink or a shared tag. */
export interface GraphEdge {
	source: string;
	target: string;
}

/**
 * @brief Adds shared-tag connections without duplicating wikilinks or building large cliques.
 * @param nodes Published graph nodes with resolved tags.
 * @param edges Existing wikilink edges, updated in place.
 * @return Nothing.
 */
function connectSharedTags(nodes: GraphNode[], edges: Map<string, GraphEdge>): void {
	const byTag = new Map<string, string[]>();
	for (const node of nodes) {
		for (const tag of node.tags) {
			const peers = byTag.get(tag.slug) ?? [];
			peers.push(node.slug);
			byTag.set(tag.slug, peers);
		}
	}
	for (const peers of byTag.values()) connectTagGroup(peers, edges);
}

/**
 * @brief Fully links small groups and uses a connected hub for groups above 24 posts.
 * @param slugs Posts sharing one tag.
 * @param edges Existing connections, updated in place.
 * @return Nothing.
 */
function connectTagGroup(slugs: string[], edges: Map<string, GraphEdge>): void {
	for (let index = 1; index < slugs.length; index += 1) {
		const target = slugs[index]!;
		const sources = slugs.slice(0, slugs.length > 24 ? 1 : index);
		for (const source of sources) {
			if (source === target || edges.has(`${source}\0${target}`) ||
				edges.has(`${target}\0${source}`)) continue;
			edges.set(`${source}\0${target}`, { source, target });
		}
	}
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
	const nodes = rows.map((row) => ({
		id: row.id,
		slug: row.slug,
		title: row.title,
		description: canReadPost(row.audience) ? row.description : '',
		publishedAt: row.publishedAt!.toISOString(),
		tags: row.tags.flatMap((name) => {
			const tag = byTag.get(name);
			return tag ? [{ name, slug: tag.slug, color: tag.color }] : [];
		})
	}));
	connectSharedTags(nodes, edges);
	return { nodes, edges: [...edges.values()] };
}
