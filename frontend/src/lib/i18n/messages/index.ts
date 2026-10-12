/**
 * @file index.ts
 * @brief Merges the per-area catalogs into one compile-time checked English and Italian pair.
 */
import { adminEn } from './admin.en.js';
import { adminIt } from './admin.it.js';
import { authEn } from './auth.en.js';
import { authIt } from './auth.it.js';
import { commonEn } from './common.en.js';
import { commonIt } from './common.it.js';
import { editorEn } from './editor.en.js';
import { editorIt } from './editor.it.js';
import { publicEn } from './public.en.js';
import { publicIt } from './public.it.js';
import { securityEn } from './security.en.js';
import { securityIt } from './security.it.js';
import { pagesEn } from './pages.en.js';
import { pagesIt } from './pages.it.js';

export const en = {
	...commonEn,
	...publicEn,
	...authEn,
	...adminEn,
	...editorEn,
	...securityEn,
	...pagesEn
} as const;

export type MessageKey = keyof typeof en;

export const it: Record<MessageKey, string> = {
	...commonIt,
	...publicIt,
	...authIt,
	...adminIt,
	...editorIt,
	...securityIt,
	...pagesIt
};
