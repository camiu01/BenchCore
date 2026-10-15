<!-- @file CategoryField.svelte @brief One optional main category, separate from free-form post tags. -->
<script lang="ts">
	import { t } from '../i18n/t.svelte.js';
	let { value = '' }: { value?: string } = $props();
</script>

<div>
	<label class="field-label" for="category">{t('publishing.category')}</label>
	<input class="field-input" id="category" name="category" value={value} maxlength="80"
		aria-describedby="category-help" />
	<p class="field-help" id="category-help">{t('publishing.categoryHelp')}</p>
</div>
