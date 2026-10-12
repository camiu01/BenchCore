<!-- @file +page.svelte @brief Public reader guide and account recovery directions. -->
<script lang="ts">
	import type { PageData } from './$types';
	import InformationPage from '../../lib/components/InformationPage.svelte';
	import { INFO_PAGES } from '../../lib/info-pages.js';
	let { data }: { data: PageData } = $props();
</script>

<InformationPage
	content={INFO_PAGES.help}
	siteBase={data.siteBase}
	sessionRole={data.sessionRole}
/>
