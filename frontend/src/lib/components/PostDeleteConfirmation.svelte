<!-- @file PostDeleteConfirmation.svelte @brief Explicit confirmation for permanent post deletion. -->
<script lang="ts">
	import { t } from '../i18n/t.svelte.js';

	interface Props {
		title: string;
		disabled: boolean;
		oncancel: () => void;
	}
	let { title, disabled, oncancel }: Props = $props();
</script>

<section class="delete-confirmation" id="post-delete-confirmation" aria-labelledby="delete-heading">
	<h3 id="delete-heading">{t('admin.delete.heading')}</h3>
	<p>{t('admin.delete.body', { title: title || t('admin.delete.untitled') })}</p>
	<div class="btn-row">
		<button class="btn danger" type="submit" formaction="?/delete" formnovalidate {disabled}>
			{t('admin.delete.confirm')}
		</button>
		<button class="btn" type="button" onclick={oncancel}>{t('admin.delete.cancel')}</button>
	</div>
</section>
