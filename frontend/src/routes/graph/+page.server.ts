/**
 * @file +page.server.ts
 * @brief Loads the published wikilink graph and optional focused post.
 */
import { getGraph } from '../../lib/api.js';
import type { PageServerLoad } from './$types';

/**
 * @brief Loads graph data with a bounded optional focus slug.
 * @param event Request URL.
 * @return Graph page data and API state.
 */
export const load: PageServerLoad = async ({ url }) => {
	const requested = url.searchParams.get('focus');
	const focus = requested && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requested) ? requested : null;
	const graph = await getGraph();
	return { graph: graph ?? { nodes: [], edges: [] }, online: graph !== null, focus };
};
