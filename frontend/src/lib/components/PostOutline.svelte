<!-- @file PostOutline.svelte @brief Collapsible heading navigation for posts with multiple sections. -->
<script lang="ts">
	import type { PostHeading } from '../post-outline.js';
	import { t } from '../i18n/t.svelte.js';
	let { headings }: { headings: PostHeading[] } = $props();
</script>

{#if headings.length >= 3}
	<nav class="post-outline" aria-label={t('public.outline.label')}>
		<details open>
			<summary>{t('public.outline.label')}</summary>
			<ol>
				{#each headings as heading (heading.id)}
					<li data-level={heading.level}><a href="#{heading.id}">{heading.title}</a></li>
				{/each}
			</ol>
		</details>
	</nav>
{/if}

<style>
	.post-outline {
		margin: 24px 0;
		padding: 16px 24px;
		border: 1px solid var(--border-light);
		background: var(--card-bg);
	}
	summary {
		min-height: 44px;
		cursor: pointer;
		font-weight: bold;
		padding: 8px 0;
	}
	ol {
		list-style: none;
		padding: 0;
		margin: 8px 0 0;
	}
	li[data-level='3'] {
		padding-left: 16px;
	}
	li[data-level='4'] {
		padding-left: 32px;
	}
	a {
		min-height: 44px;
		display: inline-block;
		padding: 8px 0;
		overflow-wrap: anywhere;
	}
</style>
