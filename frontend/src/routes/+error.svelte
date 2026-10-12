<!-- @file +error.svelte @brief Root error boundary preserving SvelteKit's HTTP status and safe recovery text. -->
<script lang="ts">
	import { page } from '$app/state';
	import ErrorPage from '../lib/components/ErrorPage.svelte';
</script>

<ErrorPage status={page.status} />
