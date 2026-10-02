/**
 * @file +layout.server.ts
 * @brief Exposes trusted canonical configuration without bundling process.env in browsers.
 */
import { siteBase } from '../lib/site.js';
import type { LayoutServerLoad } from './$types';

/**
 * @brief Loads the public canonical base for all pages.
 * @return The canonical site base.
 */
export const load: LayoutServerLoad = () => ({ siteBase: siteBase() });
