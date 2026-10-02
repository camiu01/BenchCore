/**
 * @file app.d.ts
 * @brief * SvelteKit app-level type declarations.
 * See https://svelte.dev/docs/kit/types#app.d.ts
 */
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: { id: string; email: string; name: string; role: string } | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
