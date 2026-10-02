/**
 * @file database-sql.test.ts
 * @brief Exercises generated PostgreSQL statements with an offline driver stub.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { describe, expect, it } from 'vitest';
import { createDrizzlePosts, createDrizzleTags, createDrizzleUsers } from '../src/db/drizzle.js';
import { createDrizzleMedia } from '../src/db/drizzle-media.js';
import * as schema from '../src/db/schema.js';

/** @brief Captured SQL statement and its separately bound parameters. */
interface Query {
	sql: string;
	params: unknown[];
}

/**
 * @brief Builds real Drizzle queries with a stub driver, never a live connection.
 * @param replies Queued row-array responses.
 * @return The database and query capture.
 */
function database(replies: unknown[][][] = []) {
	const queries: Query[] = [];
	const db = drizzle.mock({ schema });
	const client = db.$client as unknown as Record<string, unknown>;
	Object.assign(client, {
		/**
		 * @brief Captures a query and returns its queued response.
		 * @param text The SQL text.
		 * @param params Bound parameters.
		 * @return A postgres-js-compatible result promise.
		 */
		unsafe(text: string, params: unknown[]) {
			queries.push({ sql: text, params });
			const rows = replies.shift() ?? [];
			return Object.assign(Promise.resolve(rows), { values: async () => rows });
		},
		/**
		 * @brief Runs transaction callbacks against the isolated driver.
		 * @param callback The transaction body.
		 * @return The callback result.
		 */
		async begin(callback: (connection: unknown) => Promise<unknown>) { return callback(client); }
	});
	return { db, queries };
}

describe('PostgreSQL groundwork statements', () => {
	it('rotates credentials with hash compare-and-swap and session revocation in one transaction', async () => {
		const { db, queries } = database([[['owner']], []]);
		expect(await createDrizzleUsers(db).changePassword('owner', 'old-hash', 'new-hash')).toBe(true);
		expect(queries).toHaveLength(2);
		expect(queries[0]?.sql).toContain('"session_version" + 1');
		expect(queries[0]?.params).toContain('old-hash');
		expect(queries[0]?.params).toContain('new-hash');
		expect(queries[1]?.sql).toContain('delete from "sessions"');
		expect(queries[1]?.params).toContain('owner');
		const stale = database([[]]);
		expect(await createDrizzleUsers(stale.db).changePassword('owner', 'stale', 'new')).toBe(false);
		expect(stale.queries).toHaveLength(1);
	});

	it('serializes administrator changes and rejects removing the final active administrator', async () => {
		const owner = ['owner', 'owner@example.test', 'owner', 'hash', 'Owner', 'admin', true, 0, '2026-01-01T00:00:00Z'];
		const { db, queries } = database([[], [owner], [owner], [[1]]]);
		expect(await createDrizzleUsers(db).manage('owner', 'owner', { isActive: false })).toBe('last_admin');
		expect(queries[0]?.sql).toContain('pg_advisory_xact_lock');
		expect(queries.at(-1)?.sql).toContain('count(*)');
		expect(queries.some((query) => query.sql.startsWith('update'))).toBe(false);
	});

	it('parameterizes web search and uses the same visibility/tag/search predicate for counts', async () => {
		const { db, queries } = database([[], [[7]]]);
		const posts = createDrizzlePosts(db, createDrizzleTags(db));
		const search = 'guide"; DROP TABLE posts; --';
		const now = new Date('2026-01-20T12:00:00Z');
		const page = await posts.listPublished({ limit: 2, offset: 1, tag: 'database', search, now });
		expect(page).toEqual({ items: [], total: 7 });
		expect(queries).toHaveLength(2);
		for (const query of queries) {
			expect(query.sql).toContain('websearch_to_tsquery(\'simple\', $');
			expect(query.sql).toContain('"posts"."publish_at" is null');
			expect(query.sql).toContain('"post_tags" inner join "tags"');
			expect(query.sql).not.toContain(search);
			expect(query.params).toContain(search);
			expect(query.params).toContain('published');
			expect(query.params).toContain('database');
		}
		const predicate = (text: string) => text.slice(text.indexOf(' where ')).split(' order by ')[0];
		expect(predicate(queries[0]!.sql)).toBe(predicate(queries[1]!.sql));
	});

	it('publishes schedules in a single conditional update with the scheduled publication date', async () => {
		const { db, queries } = database([[['one'], ['two']]]);
		const posts = createDrizzlePosts(db, createDrizzleTags(db));
		const now = new Date('2026-01-20T12:00:00Z');
		expect(await posts.publishDue(now)).toBe(2);
		expect(queries).toHaveLength(1);
		const query = queries[0]!;
		expect(query.sql).toContain('"published_at" = "posts"."publish_at"');
		expect(query.sql).toMatch(/"publish_at" = \$\d+/);
		expect(query.sql).toContain('where ("posts"."status" =');
		expect(query.sql).toContain('"posts"."publish_at" <=');
		expect(query.params).toContain('draft');
		expect(query.params).toContain('published');
		expect(query.params).toContain(null);
	});

	it('deduplicates tag links and replaces them inside a transaction', async () => {
		const { db, queries } = database();
		await createDrizzleTags(db).setPostTags('post-id', ['tag-id', 'tag-id']);
		expect(queries).toHaveLength(2);
		expect(queries[0]?.sql).toContain('delete from "post_tags"');
		expect(queries[1]?.params).toEqual(['post-id', 'tag-id']);
	});

	it('writes binary blobs with bound parameters and excludes payloads from metadata listings', async () => {
		const { db, queries } = database();
		const media = createDrizzleMedia(db);
		const data = Buffer.from('image payload');
		await media.save({
			key: `${'a'.repeat(32)}.png`, filename: 'image.png', mime: 'image/png', sizeBytes: data.length, data
		});
		expect(queries[0]?.params).toContain(data);
		expect(queries[0]?.sql).toContain('insert into "media_blobs"');
		await media.list();
		expect(queries[1]?.sql).not.toContain('"data"');
		expect(queries[1]?.sql).toContain('order by "media_blobs"."filename"');
		expect(await media.load(`${'b'.repeat(32)}.png`)).toBeNull();
		expect(await media.remove(`${'b'.repeat(32)}.png`)).toBe(false);
	});
});
