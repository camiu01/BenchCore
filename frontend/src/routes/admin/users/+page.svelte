<!-- @file +page.svelte @brief Administrator user ledger and explicit account controls. -->
<script lang="ts">
	import DocShell from '../../../lib/components/DocShell.svelte';
	import Seo from '../../../lib/components/Seo.svelte';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const nav = [
		{ href: '/admin', label: '[01] admin' },
		{ href: '/account', label: '[02] account security' }
	];
</script>

<Seo
	title="Users | BenchCore"
	description="Administrator user management."
	canonical="{data.siteBase}/admin/users"
/>
<DocShell
	docId="FORM: BENCHCORE-2026 // REF: USERS"
	title="USER LEDGER"
	sub="Role or activation changes revoke all sessions. Keep at least one active administrator."
	{nav}
	footerLeft="USERS: {data.total}"
	footerRight={data.online ? 'API: LINKED' : 'API: OFFLINE'}
>
	<main>
		{#if form?.error}<p class="error-stamp" role="alert">{form.error}</p>{/if}
		{#if !data.online}<p class="error-stamp">Account service unavailable.</p>{/if}
		{#each data.items as account (account.id)}
			<article class="record">
				<div class="record-header">
					<span class="record-title">{account.name}</span><span class="stamp"
						>{account.isActive ? 'ACTIVE' : 'DISABLED'}</span
					>
				</div>
				<p class="summary">
					{account.username ?? 'Email login'} · {account.email} · {account.createdAt.slice(0, 10)}
				</p>
				<form method="POST" action="?/update" class="form-grid">
					<input type="hidden" name="id" value={account.id} />
					<label class="field-label" for="role-{account.id}">Role</label>
					<select class="field-input" id="role-{account.id}" name="role" value={account.role}>
						<option value="reader">Reader</option><option value="admin">Administrator</option>
						{#if account.role === 'editor'}<option value="editor" disabled
								>Legacy editor, choose a new role</option
							>{/if}
					</select>
					<label class="field-label" for="active-{account.id}">Account state</label>
					<select
						class="field-input"
						id="active-{account.id}"
						name="isActive"
						value={String(account.isActive)}
					>
						<option value="true">Active</option><option value="false">Disabled</option>
					</select>
					<div class="btn-row"><button class="btn" type="submit">APPLY ACCOUNT CHANGE</button></div>
				</form>
			</article>
		{/each}
		<nav class="btn-row" aria-label="User pages">
			{#if data.offset > 0}<a class="btn" href="/admin/users?offset={Math.max(0, data.offset - 25)}"
					>PREVIOUS</a
				>{/if}
			{#if data.offset + 25 < data.total}<a
					class="btn"
					href="/admin/users?offset={data.offset + 25}">NEXT</a
				>{/if}
		</nav>
		<article class="record">
			<div class="record-header"><span class="record-title">CREATE MANAGED ACCOUNT</span></div>
			<form method="POST" action="?/create" class="form-grid">
				<label class="field-label" for="newName">Display name</label>
				<input
					class="field-input"
					id="newName"
					name="name"
					required
					maxlength="200"
					autocomplete="off"
				/>
				<label class="field-label" for="newUsername">Username</label>
				<input
					class="field-input"
					id="newUsername"
					name="username"
					required
					minlength="3"
					maxlength="32"
					autocomplete="off"
				/>
				<label class="field-label" for="newEmail">Email</label>
				<input
					class="field-input"
					id="newEmail"
					name="email"
					type="email"
					required
					maxlength="254"
					autocomplete="off"
				/>
				<label class="field-label" for="newPassword">Temporary password, 8+ characters</label>
				<input
					class="field-input"
					id="newPassword"
					name="password"
					type="password"
					required
					minlength="8"
					maxlength="200"
					autocomplete="new-password"
				/>
				<label class="field-label" for="newRole">Role</label>
				<select class="field-input" id="newRole" name="role"
					><option value="reader">Reader</option><option value="admin">Administrator</option
					></select
				>
				<div class="btn-row">
					<button class="btn btn-accent" type="submit">CREATE ACCOUNT</button>
				</div>
			</form>
		</article>
	</main>
</DocShell>
