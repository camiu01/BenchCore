<!-- @file +page.svelte @brief Application data handling without invented operator or provider policies. -->
<script lang="ts">
	import type { PageData } from './$types';
	import InformationPage from '../../lib/components/InformationPage.svelte';
	import { INFO_PAGES } from '../../lib/info-pages.js';
	let { data }: { data: PageData } = $props();
</script>

<InformationPage
	content={INFO_PAGES.privacy}
	siteBase={data.siteBase}
	sessionRole={data.sessionRole}
/>
