/**
 * @file document.ts
 * @brief Offline OpenAPI 3.1 description of the current unversioned API.
 */
import { readFileSync } from 'node:fs';
import { SESSION_COOKIE } from '../../src/auth/session.js';
import { authPaths, authSchemas } from './auth.js';
import { postPaths, postSchemas } from './posts.js';
import { mediaPaths, mediaSchemas } from './media.js';
import { publishingPaths, publishingSchemas } from './publishing.js';
import { responseSchemas } from './schemas.js';
import { errorResponses, operation, type Paths } from './helpers.js';

const manifest: { version: string } = JSON.parse(
	readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
);
const paths: Paths = {
	'/health': {
		get: operation({
			id: 'getHealth',
			summary: 'Read service liveness',
			tag: 'Health',
			result: 'Health',
			description:
				'Standalone API reports status/service/license without probing dependencies. Unified runtime intercepts this path and returns status only; /health/live and /health/ready are deployment-layer probes, not standalone API routes.'
		})
	},
	...authPaths,
	...postPaths,
	...mediaPaths,
	...publishingPaths
};

export const openapi = {
	openapi: '3.1.0',
	'x-file': 'docs/openapi.json',
	'x-brief': 'Generated current HTTP contract. Edit api/scripts/openapi, then run pnpm api:spec.',
	info: {
		title: 'BenchCore API',
		version: manifest.version,
		license: { name: 'AGPL-3.0-or-later', identifier: 'AGPL-3.0-or-later' },
		description:
			'Current unversioned HTTP API, not a frozen API v1 or a 1.0 release promise. All mutations require an exact trusted Origin, including credential/consent endpoints. Administrator operations additionally require an active admin cookie session. Errors use stable error identifiers, optional localized message and optional English issues. Regular JSON body cap is 256 KiB unless documented otherwise. Quotas are process-local, not fleet-wide. Cookie-dependent responses are private/no-store. Source handlers and Zod input validators are authoritative; JSON Schema cannot express every cross-field, byte-count or domain rule. See docs/API.md for deployment differences.'
	},
	servers: [
		{
			url: '/',
			description: 'Same-origin unified Node/Vercel delivery; do not expose the SSR bridge.'
		},
		{
			url: 'http://localhost:5181',
			description: 'Standalone local development API; use a configured trusted Origin for writes.'
		}
	],
	tags: [
		'Authentication',
		'Posts',
		'Engagement',
		'Administration',
		'Media',
		'Newsletter',
		'Health'
	].map((name) => ({ name })),
	paths,
	components: {
		responses: errorResponses,
		securitySchemes: {
			session: {
				type: 'apiKey',
				in: 'cookie',
				name: SESSION_COOKIE,
				description:
					'Opaque HttpOnly SameSite=Lax cookie obtained from login; Secure in production. No bearer-token API exists. Admin role is documented per operation, not an OAuth scope.'
			}
		},
		schemas: {
			...responseSchemas,
			...authSchemas,
			...postSchemas,
			...mediaSchemas,
			...publishingSchemas,
			Health: {
				type: 'object',
				required: ['status'],
				properties: {
					status: { type: 'string', const: 'ok' },
					service: { type: 'string', const: 'benchcore-api' },
					license: { type: 'string', const: 'AGPL-3.0-or-later' }
				}
			}
		}
	}
};

/** @brief Serializes the reproducible, checked-in contract without loading secrets or services. @return Pretty JSON with trailing newline. */
export function serializeOpenApi(): string {
	return JSON.stringify(openapi, null, '\t') + '\n';
}
