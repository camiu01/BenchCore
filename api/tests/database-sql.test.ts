/**
 * @file database-sql.test.ts
 * @brief Exercises generated PostgreSQL statements with an offline driver stub.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { describe, expect, it } from 'vitest';
import { createDrizzlePosts, createDrizzleTags, createDrizzleUsers } from '../src/db/drizzle.js';
import { createDrizzleMedia } from '../src/db/drizzle-media.js';
import * as schema from '../src/db/schema.js';
import { createDrizzleSecurity } from '../src/db/drizzle-security.js';
import { recoverTotp, rotatePassword } from '../src/db/account-maintenance.js';

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
	it('restricts guest full-text search on reader posts to their public title', async () => {
		const guest = database([[], [[0]]]);
		await createDrizzlePosts(guest.db, createDrizzleTags(guest.db)).listPublished({
			limit: 10, offset: 0, now: new Date(), search: 'privateword'
		});
		expect(guest.queries[0]?.sql).toContain('case when "posts"."audience"');
		expect(guest.queries[0]?.sql).toContain('to_tsvector(\'simple\', "posts"."title")');
		const reader = database([[], [[0]]]);
		await createDrizzlePosts(reader.db, createDrizzleTags(reader.db)).listPublished({
			limit: 10, offset: 0, now: new Date(), search: 'privateword', includeReaderContent: true
		});
		expect(reader.queries[0]?.sql).not.toContain('case when');
		expect(reader.queries[0]?.sql).toContain('"posts"."search_vector"');
	});
	it('counts all tags in one SQL query without fetching post bodies or leaking future posts', async () => {
		const { db, queries } = database([[['tag-id', 'Systems', 'systems', '#2563EB', '2']]]);
		const posts = createDrizzlePosts(db, createDrizzleTags(db));
		const counts = await posts.listTagCounts(new Date('2026-10-05T12:00:00Z'));
		expect(counts).toEqual([{ id: 'tag-id', name: 'Systems', slug: 'systems', color: '#2563EB', count: 2 }]);
		expect(queries).toHaveLength(1);
		const query = queries[0]!;
		expect(query.sql).toContain('count("posts"."id")');
		expect(query.sql).toContain('left join "posts" on');
		expect(query.sql).toContain('"posts"."published_at" <=');
		expect(query.sql).toContain('"posts"."publish_at" is null');
		expect(query.sql).toContain('group by');
		expect(query.sql).not.toContain('content_markdown');
		expect(query.params).toContain('published');
	});
	it('rotates credentials with hash compare-and-swap and session revocation in one transaction', async () => {
		const { db, queries } = database([[['owner']], []]);
		expect(await createDrizzleUsers(db).changePassword('owner', 'old-hash', 'new-hash')).toBe(true);
		expect(queries).toHaveLength(4);
		expect(queries[0]?.sql).toContain('"session_version" + 1');
		expect(queries[0]?.params).toContain('old-hash');
		expect(queries[0]?.params).toContain('new-hash');
		expect(queries[1]?.sql).toContain('delete from "sessions"');
		expect(queries[1]?.params).toContain('owner');
		expect(queries[2]?.sql).toContain('delete from "password_reset_tokens"');
		expect(queries[3]?.sql).toContain('insert into "security_events"');
		expect(queries[3]?.params).toContain('password.changed');
		expect(queries[3]?.params).not.toContain('new-hash');
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
		const predicate = (text: string) => text.slice(text.indexOf(' from "posts" where ') + ' from "posts"'.length).split(' order by ')[0];
		expect(predicate(queries[0]!.sql)).toBe(predicate(queries[1]!.sql));
	});

	it('groups AND tags, parameterizes names and redacts guest popularity before ordering', async () => {
		const fixture = database([[], [[0]]]);
		const name = 'tag"; DROP TABLE posts; --';
		await createDrizzlePosts(fixture.db, createDrizzleTags(fixture.db)).listPublished({
			limit: 10, offset: 0, now: new Date(), tags: [name, 'other', name], tagMode: 'and', sort: 'popular'
		});
		expect(fixture.queries[0]?.sql).toContain('having count(distinct "tags"."name")');
		expect(fixture.queries[0]?.params).toContain(2);
		expect(fixture.queries[0]?.params).toContain(name);
		expect(fixture.queries[0]?.sql).not.toContain(name);
		expect(fixture.queries[0]?.sql).toContain('then 0 else (select count(*)::integer from "likes"');
		const either = database([[], [[0]]]);
		await createDrizzlePosts(either.db, createDrizzleTags(either.db)).listPublished({
			limit: 10, offset: 0, now: new Date(), tags: [name, 'other'], tagMode: 'or', sort: 'updated'
		});
		expect(either.queries[0]?.sql).not.toContain('having');
		expect(either.queries[0]?.sql).toContain('order by "posts"."updated_at" desc');
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

describe('transactional security persistence', () => {
	const owner = ['owner', 'owner@example.test', 'owner', 'hash', 'Owner', 'admin', true, 3, '2026-01-01T00:00:00Z'];
	it('locks account state and consumes a code with a monotonic SQL watermark', async () => {
		const fixture = database([[owner], [['owner', 'ciphertext', 123]]]);
		expect(await createDrizzleSecurity(fixture.db).consumeTotp('owner', 3, 123)).toBe(true);
		expect(fixture.queries[0]?.sql).toContain('for update');
		expect(fixture.queries[1]?.sql).toContain('"administrator_totp"."last_step" <');
		expect(fixture.queries[1]?.params).toContain(123);
		const stale = database([[owner]]);
		expect(await createDrizzleSecurity(stale.db).consumeTotp('owner', 2, 123)).toBe(false);
		expect(stale.queries).toHaveLength(1);
	});
	it('enables a factor and revokes sessions with a credential-free audit in one transaction', async () => {
		const fixture = database([[owner], [['owner', 'ciphertext', 123]]]);
		expect(await createDrizzleSecurity(fixture.db).enableTotp('owner', 3, 'hash', 'ciphertext', 123)).toBe(true);
		expect(fixture.queries).toHaveLength(5);
		expect(fixture.queries[0]?.sql).toContain('for update');
		expect(fixture.queries[1]?.sql).toContain('on conflict do nothing');
		expect(fixture.queries[2]?.sql).toContain('"session_version" + 1');
		expect(fixture.queries[3]?.sql).toContain('delete from "sessions"');
		expect(fixture.queries[4]?.params).toContain('totp.enabled');
		expect(fixture.queries[4]?.params).not.toContain('ciphertext');
		expect(fixture.queries[4]?.params).not.toContain('hash');
		const conflict = database([[owner], []]);
		expect(await createDrizzleSecurity(conflict.db).enableTotp('owner', 3, 'hash', 'ciphertext', 123)).toBe(false);
		expect(conflict.queries).toHaveLength(2);
	});
	it('disables factors only with a fresh watermark and current credentials', async () => {
		const fixture = database([[owner], [['owner', 'ciphertext', 122]]]);
		expect(await createDrizzleSecurity(fixture.db).disableTotp('owner', 3, 'hash', 123)).toBe(true);
		expect(fixture.queries[1]?.sql).toContain('"administrator_totp"."last_step" <');
		expect(fixture.queries.at(-1)?.params).toContain('totp.disabled');
		const stale = database([[owner]]);
		expect(await createDrizzleSecurity(stale.db).disableTotp('owner', 3, 'different-hash', 123)).toBe(false);
		expect(stale.queries).toHaveLength(1);
	});
	it('audits selected deletion alongside the delete and rechecks administrator state', async () => {
		const fixture = database([[owner], [['selected-one'], ['selected-two']]]);
		expect(await createDrizzleSecurity(fixture.db).deletePosts('owner', ['selected-one', 'selected-two'])).toBe(2);
		expect(fixture.queries[0]?.sql).toContain('for update');
		expect(fixture.queries[1]?.sql).toContain('where "posts"."id" in');
		expect(fixture.queries[1]?.params).toEqual(['selected-one', 'selected-two']);
		expect(fixture.queries[2]?.params).toContain('posts.deleted');
		expect(fixture.queries[2]?.params).toContain(2);
		const missing = database([[]]);
		await expect(createDrizzleSecurity(missing.db).deletePosts('owner', ['selected'])).rejects.toThrow();
		expect(missing.queries).toHaveLength(1);
	});
	it('audits administrator-initiated creation without storing credentials in the event', async () => {
		const fixture = database([[owner]]);
		await createDrizzleUsers(fixture.db).create({
			id: 'owner', username: 'owner', email: 'owner@example.test', name: 'Owner', role: 'admin', passwordHash: 'hash'
		}, 'actor');
		expect(fixture.queries).toHaveLength(2);
		expect(fixture.queries[1]?.params).toContain('user.created');
		expect(fixture.queries[1]?.params).toContain('actor');
		expect(fixture.queries[1]?.params).not.toContain('hash');
		expect(fixture.queries[1]?.params).not.toContain('owner@example.test');
	});
	it('uses session-epoch compare-and-swap for global logout', async () => {
		const fixture = database([[['owner']]]);
		expect(await createDrizzleUsers(fixture.db).revokeSessions('owner', 3)).toBe(true);
		expect(fixture.queries).toHaveLength(3);
		expect(fixture.queries[0]?.sql).toContain('"users"."session_version" =');
		expect(fixture.queries[0]?.params).toContain(3);
		expect(fixture.queries[1]?.sql).toContain('delete from "sessions"');
		expect(fixture.queries[2]?.params).toContain('sessions.revoked');
	});
	it('audits offline password and factor recovery while clearing outstanding reset tokens', async () => {
		const password = database([[['owner']]]);
		expect(await rotatePassword(password.db, 'owner', 'replacement-hash')).toBe(true);
		expect(password.queries[2]?.sql).toContain('delete from "password_reset_tokens"');
		expect(password.queries[3]?.params).toContain('password.changed');
		expect(password.queries[3]?.params).not.toContain('replacement-hash');
		const factor = database([[owner], [['owner', 'ciphertext', 123]]]);
		expect(await recoverTotp(factor.db, 'owner')).toBe(true);
		expect(factor.queries[0]?.sql).toContain('for update');
		expect(factor.queries[4]?.sql).toContain('delete from "password_reset_tokens"');
		expect(factor.queries[5]?.params).toContain('totp.disabled');
	});
	it('orders security history deterministically and bounds SQL pages without selecting secrets', async () => {
		const fixture = database();
		await createDrizzleSecurity(fixture.db).listEvents(50);
		expect(fixture.queries[0]?.sql).toContain('order by "security_events"."created_at" desc, "security_events"."id" desc');
		expect(fixture.queries[0]?.params).toEqual([51, 50]);
		expect(fixture.queries[0]?.sql).not.toContain('sealed_secret');
		expect(fixture.queries[0]?.sql).not.toContain('password_hash');
	});
});
