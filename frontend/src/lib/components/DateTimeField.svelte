<!-- @file DateTimeField.svelte @brief Local-time date picker that submits canonical UTC ISO values. -->
<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		id: string;
		name: string;
		label: string;
		value: string;
		readonly?: boolean;
	}

	let { id, name, label, value, readonly = false }: Props = $props();
	let localValue = $state('');
	let isoValue = $state(initialIso());
	let timezone = $state('local time');

	/** @brief Captures the initial canonical value for SSR form submission. @return Initial timestamp. */
	function initialIso(): string {
		return value;
	}

	/**
	 * @brief Converts a canonical timestamp to a datetime-local value.
	 * @param iso Canonical timestamp.
	 * @return Browser-local date and minute.
	 */
	function toLocalInput(iso: string): string {
		if (!iso) return '';
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';
		const offset = date.getTimezoneOffset() * 60_000;
		return new Date(date.getTime() - offset).toISOString().slice(0, 16);
	}

	/**
	 * @brief Converts the selected local time to canonical UTC.
	 * @return Nothing.
	 */
	function updateIso(): void {
		isoValue = localValue === '' ? '' : new Date(localValue).toISOString();
	}

	/** @brief Clears both visible and canonical values. @return Nothing. */
	function clear(): void {
		localValue = '';
		isoValue = '';
	}

	onMount(() => {
		localValue = toLocalInput(value);
		isoValue = value;
		timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
	});
</script>

<div class="datetime-field">
	<label class="field-label" for={id}>{label}</label>
	<div class="datetime-controls">
		<input
			class="field-input"
			{id}
			type="datetime-local"
			step="60"
			bind:value={localValue}
			oninput={updateIso}
			{readonly}
		/>
		<input type="hidden" {name} value={isoValue} />
		{#if isoValue}
			<button class="btn" type="button" onclick={clear}>CLEAR</button>
		{/if}
	</div>
	<small class="field-help">{timezone}; stored as UTC.</small>
</div>
