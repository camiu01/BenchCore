<!-- @file TagColorEditor.svelte @brief Accessible preset and custom HEX tag color editor. -->
<script lang="ts">
	interface Props {
		id: string;
		name: string;
		color: string;
	}

	let { id, name, color: initialColor }: Props = $props();
	let color = $state(initialValue());
	const palette = [
		'#2563EB',
		'#7C3AED',
		'#DB2777',
		'#DC2626',
		'#EA580C',
		'#16A34A',
		'#0891B2',
		'#64748B'
	];

	/** @brief Captures the initial tag color. @return Initial HEX color. */
	function initialValue(): string {
		return initialColor;
	}
</script>

<form method="POST" action="?/color" class="tag-color-form">
	<input type="hidden" name="id" value={id} />
	<div class="tag-swatches" aria-label="Preset colors">
		{#each palette as preset (preset)}
			<button
				type="button"
				class:active={color.toUpperCase() === preset}
				class="tag-swatch"
				aria-label="Use {preset} for {name}"
				title={preset}
				onclick={() => (color = preset)}
				><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
					<rect width="18" height="18" fill={preset} />
				</svg></button
			>
		{/each}
	</div>
	<div class="tag-custom-color">
		<input type="color" bind:value={color} aria-label="Color picker for {name}" />
		<input
			class="field-input color-code"
			name="color"
			bind:value={color}
			pattern="#[0-9A-Fa-f]{6}"
			maxlength="7"
			required
			aria-label="HEX color for {name}"
		/>
		<button class="btn" type="submit">SAVE</button>
	</div>
</form>
