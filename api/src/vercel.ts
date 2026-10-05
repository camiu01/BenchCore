/**
 * @file vercel.ts
 * @brief Fetch-compatible Node backend entrypoint for Vercel Services.
 */
import { createVercelHandler } from './serverless/handler.js';
import { nodeHandlerFetch } from './http/web.js';

const handler = createVercelHandler(process.env);
type NodeBackedRequest = Request & { readonly node?: { req?: { socket?: { remoteAddress?: string } } } };

export default {
	/**
	 * @brief Dispatches to the secured native router through Vercel's backend fetch contract.
	 * @param request Hosting request with optional native transport context.
	 * @return API response, never trusting forwarded client-IP headers.
	 */
	fetch(request: NodeBackedRequest): Promise<Response> {
		return nodeHandlerFetch(handler, request, request.node?.req?.socket?.remoteAddress ?? 'unknown');
	}
};
