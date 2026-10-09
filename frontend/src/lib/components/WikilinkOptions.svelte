<!-- @file WikilinkOptions.svelte @brief Keyboard-active post and tag matches without editor business logic. -->
<script lang="ts">
	import { t } from '../i18n/t.svelte.js';
	import type { WikilinkSuggestion } from '../wikilink-suggestions.js';
	let {
		matches,
		active,
		onselect
	}: { matches: WikilinkSuggestion[]; active: number; onselect: (slug: string) => void } = $props();
</script>

{#if matches.length}
	<div class="wikilink-suggestions" role="listbox" aria-label={t('editor.wikilink.suggestions')}>
		{#each matches as post, index (post.slug)}
			<button
				type="button"
				role="option"
				aria-selected={index === active}
				class:active={index === active}
				onmousedown={(event) => event.preventDefault()}
				onclick={() => onselect(post.slug)}
			>
				<strong>{post.title}</strong>
				<code>{post.slug}</code>
				{#if post.tags?.length}<span class="field-help">{post.tags.join(' · ')}</span>{/if}
			</button>
		{/each}
	</div>
{/if}
