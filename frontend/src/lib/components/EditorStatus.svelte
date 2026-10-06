<!-- @file EditorStatus.svelte @brief Saved-state feedback and navigation protection for the editor. -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { EditorValues } from '../server/editor-values.js';
	import { editorSnapshot, liveEditorSnapshot } from '../editor-state.js';

	let {
		values,
		savedValues,
		isNew,
		busy,
		onbusy
	}: {
		values: EditorValues;
		savedValues: EditorValues;
		isNew: boolean;
		busy: boolean;
		onbusy: (busy: boolean) => void;
	} = $props();
	let element: HTMLParagraphElement;
	let form: HTMLFormElement | null = null;
	let liveSnapshot = $state<string | null>(null);
	let submitting = $state(false);
	let allowRedirect = false;
	const baseline = $derived(editorSnapshot(savedValues));
	const dirty = $derived((liveSnapshot ?? editorSnapshot(values)) !== baseline);

	/** @brief Refreshes after Svelte has updated hidden date and image fields. @return Completion. */
	async function refresh(): Promise<void> {
		await tick();
		if (form) liveSnapshot = liveEditorSnapshot(form);
	}

	$effect(() => {
		void baseline;
		void values;
		void refresh();
	});

	beforeNavigate((navigation) => {
		if (!dirty || allowRedirect || navigation.willUnload) return;
		const from = navigation.from?.url;
		const to = navigation.to?.url;
		if (from && to && from.pathname === to.pathname && from.search === to.search) return;
		if (!window.confirm('You have unsaved changes. Leave this page and discard them?'))
			navigation.cancel();
	});

	/** @brief Requests the browser's native warning on reload, close or external navigation. @param event Unload event. @return Nothing. */
	function warnOnUnload(event: BeforeUnloadEvent): void {
		if (!dirty || allowRedirect) return;
		event.preventDefault();
		event.returnValue = '';
	}

	onMount(() => {
		form = element.closest('form');
		if (!form) return;
		const current = form;
		const enhanced = enhance(current, ({ cancel }) => {
			if (busy || submitting) {
				cancel();
				return;
			}
			submitting = true;
			onbusy(true);
			return async ({ result, update }) => {
				allowRedirect = result.type === 'redirect';
				try {
					await update({ reset: false });
				} finally {
					allowRedirect = false;
					submitting = false;
					onbusy(false);
					await refresh();
				}
			};
		});
		for (const name of ['input', 'change', 'click']) current.addEventListener(name, refresh);
		window.addEventListener('beforeunload', warnOnUnload);
		void refresh();
		return () => {
			form = null;
			enhanced.destroy();
			for (const name of ['input', 'change', 'click']) current.removeEventListener(name, refresh);
			window.removeEventListener('beforeunload', warnOnUnload);
		};
	});
</script>

<p bind:this={element} class="editor-status field-help" role="status" aria-live="polite">
	{submitting
		? 'Submitting…'
		: dirty
			? 'Unsaved changes'
			: isNew
				? 'Not saved yet'
				: 'No unsaved changes'}
	<span> · Autosave is off.</span>
</p>
