<!-- @file CategoryFilter.svelte @brief Shareable archive category selector. -->
<script lang="ts">
	import { t } from '../i18n/t.svelte.js';
	let { selected, items }: { selected: string; items: { name: string; count: number }[] } =
		$props();
	const names = $derived([
		...new Set([...items.map((item) => item.name), ...(selected ? [selected] : [])])
	]);
</script>

<div>
	<label class="field-label" for="category-filter">{t('publishing.category')}</label>
	<select class="field-input" id="category-filter" name="category">
		<option value="">{t('publishing.allCategories')}</option>
		{#each names as name (name)}<option value={name} selected={selected === name}>{name}</option
			>{/each}
	</select>
</div>
