<script lang="ts">
	import type { PageData } from './$types';
	import DocShell from '../lib/components/DocShell.svelte';
	import Seo from '../lib/components/Seo.svelte';
	import { siteBase } from '../lib/site.js';

	let { data }: { data: PageData } = $props();

	const nav = [
		{ href: '/posts', label: '[01] records' },
		{ href: '/tags', label: '[02] tags' },
		{ href: '/admin', label: '[03] admin' }
	];
</script>

<Seo title={data.title} description={data.description} canonical={siteBase()} />

<DocShell
	docId="FORM: BLOG-2026 // REF: PUB-LOG"
	title="ENGINEERING LOG"
	sub={data.description}
	{nav}
	footerLeft="LOC: DEV // STATUS: ONLINE"
	footerRight="STACK: SVELTEKIT + TS"
>
	<main id="records">
		{#if data.posts === null}
			<article class="record">
				<div class="record-header">
					<span class="record-title">REC_00: UPLINK // NO CARRIER</span>
					<span class="stamp">API OFFLINE</span>
				</div>
				<p class="summary">
					The API is unreachable. Start it with <code>pnpm dev:api</code> and reload this sheet.
				</p>
			</article>
		{:else if data.posts.items.length === 0}
			<article class="record">
				<div class="record-header">
					<span class="record-title">REC_00: ARCHIVE // EMPTY</span>
					<span class="stamp">NO RECORDS</span>
				</div>
				<p class="summary">
					No published posts yet. Run <code>pnpm seed</code> to bootstrap the admin and import
					<code>content/posts</code>.
				</p>
			</article>
		{:else}
			{#each data.posts.items as post (post.id)}
				<article class="record">
					<div class="record-header">
						<span class="record-title">
							<a href="/posts/{post.slug}" style="color: inherit; text-decoration: none;"
								>{post.title}</a
							>
						</span>
						<span class="stamp">PUBLISHED</span>
					</div>
					<p class="summary">{post.description}</p>
					<table class="spec-table">
						<tbody>
							<tr>
								<td class="label">FILED</td>
								<td>{post.publishedAt ?? 'undated'}</td>
							</tr>
							{#if post.tags.length > 0}
								<tr>
									<td class="label">TAGS</td>
									<td>
										{#each post.tags as tag, index (tag)}<a href="/tags/{encodeURIComponent(tag)}"
												>{tag}</a
											>{#if index < post.tags.length - 1},
											{/if}{/each}
									</td>
								</tr>
							{/if}
							{#if post.authorName !== null}
								<tr>
									<td class="label">AUTHOR</td>
									<td>{post.authorName}</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</article>
			{/each}
		{/if}
	</main>

	<section class="tool-section" id="appendix">
		<div class="section-banner">// APPENDIX A: MILESTONE LEDGER</div>
		<table class="inventory-table">
			<thead>
				<tr>
					<th>ID</th>
					<th>MILESTONE</th>
					<th>STATUS & NOTES</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td class="code">M1</td>
					<td class="item">Scaffolding + DX</td>
					<td class="dim">DONE — monorepo, tooling, sheet theme, health endpoint</td>
				</tr>
				<tr>
					<td class="code">M2</td>
					<td class="item">Content pipeline</td>
					<td class="dim">DONE — TOML + Zod + Markdown + sanitize + wikilinks</td>
				</tr>
				<tr>
					<td class="code">M3</td>
					<td class="item">Database + import CLI</td>
					<td class="dim">DONE — Drizzle schema, repos, content:import, seed</td>
				</tr>
				<tr>
					<td class="code">AUTH</td>
					<td class="item">Sessions + login</td>
					<td class="dim">DONE — scrypt, HttpOnly cookies, /login, /admin guard</td>
				</tr>
				<tr>
					<td class="code">BLOG</td>
					<td class="item">Public site + API</td>
					<td class="dim">DONE — records, tags, backlinks, media, RSS, sitemap</td>
				</tr>
				<tr>
					<td class="code">OPS</td>
					<td class="item">Docker</td>
					<td class="dim">DONE — compose: postgres + api + frontend</td>
				</tr>
				<tr>
					<td class="code">NEXT</td>
					<td class="item">Search + scheduling</td>
					<td class="dim">QUEUED — tsvector search, revisions, comments</td>
				</tr>
			</tbody>
		</table>
	</section>
</DocShell>
