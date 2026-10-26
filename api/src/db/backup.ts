/**
 * @file backup.ts
 * @brief Read-only catalog inspection for empty-target recovery guards.
 */
import postgres from 'postgres';

/** @brief Rejects user schemas, relations, routines and standalone types before recovery. @param url Explicit recovery database URL. @return Completion. */
export async function assertEmptyDatabase(url: string): Promise<void> {
	const sql = postgres(url, {
		max: 1,
		prepare: false,
		connect_timeout: 10,
		onnotice: () => undefined
	});
	try {
		const rows = await sql`
			select exists (
				select 1 from pg_namespace where nspname !~ '^pg_' and nspname not in ('public', 'information_schema')
				union all
				select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
					where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
				union all
				select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
					where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
				union all
				select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
					where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
			) as occupied`;
		if (rows[0]?.['occupied'] !== false) throw new Error('Recovery database must be empty');
	} finally {
		await sql.end({ timeout: 5 });
	}
}
