<!-- @file PostDeleteConfirmation.svelte @brief Explicit confirmation for permanent post deletion. -->
<script lang="ts">
	interface Props {
		title: string;
		disabled: boolean;
		oncancel: () => void;
	}
	let { title, disabled, oncancel }: Props = $props();
</script>

<section class="delete-confirmation" id="post-delete-confirmation" aria-labelledby="delete-heading">
	<h3 id="delete-heading">Delete this post permanently?</h3>
	<p>This removes “{title || 'Untitled post'}” from the archive. This action cannot be undone.</p>
	<div class="btn-row">
		<button class="btn danger" type="submit" formaction="?/delete" formnovalidate {disabled}>
			Yes, delete permanently
		</button>
		<button class="btn" type="button" onclick={oncancel}>Keep post</button>
	</div>
</section>
