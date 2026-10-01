<script lang="ts">
	/**
	 * Reusable SEO head block: title, description, canonical,
	 * Open Graph and Twitter/X card metadata.
	 */
	interface Props {
		title: string;
		description: string;
		canonical: string;
		image?: string | null;
	}

	let { title, description, canonical, image = null }: Props = $props();
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	{#if image !== null}
		<meta property="og:image" content={image} />
	{/if}
	<meta name="twitter:card" content={image !== null ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	{#if image !== null}
		<meta name="twitter:image" content={image} />
	{/if}
</svelte:head>
