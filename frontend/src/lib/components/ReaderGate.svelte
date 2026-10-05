<!-- @file ReaderGate.svelte @brief Obscured placeholder without protected text, with reader sign-in links. -->
<script lang="ts">
	let { slug }: { slug: string } = $props();
</script>

<section class="reader-gate" aria-label="Readers-only content">
	<div class="reader-placeholder" aria-hidden="true">
		<div></div>
		<div></div>
		<div></div>
	</div>
	<div class="reader-message">
		<strong>READERS ONLY</strong>
		<p>Sign in with a reader account to read this record.</p>
		<div class="btn-row">
			<a class="btn btn-accent" href="/login?next={encodeURIComponent(`/posts/${slug}`)}"
				>SIGN IN →</a
			>
			<a class="btn" href="/register">CREATE READER ACCOUNT</a>
		</div>
	</div>
</section>

<style>
	.reader-gate {
		position: relative;
		min-height: 180px;
		padding: 24px;
		margin: 16px 0;
		border: 1px solid var(--border-light);
		background: var(--card-bg);
	}
	.reader-placeholder {
		filter: blur(4px);
		opacity: 0.2;
		pointer-events: none;
	}
	.reader-placeholder div {
		height: 12px;
		background: var(--muted);
		margin-bottom: 16px;
	}
	.reader-placeholder div:nth-child(2) {
		width: 80%;
	}
	.reader-placeholder div:nth-child(3) {
		width: 60%;
	}
	.reader-message {
		position: relative;
		margin-top: -64px;
	}
	.reader-message p {
		margin: 8px 0;
	}
</style>
