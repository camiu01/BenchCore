/**
 * @file helpers.ts
 * @brief Small OpenAPI builders for the existing HTTP contract, not runtime routing.
 */
import { z } from 'zod';

export type Schema = Record<string, unknown>;
export type Paths = Record<string, Record<string, Operation>>;
export interface Parameter {
	name: string;
	in: 'path' | 'query' | 'header';
	required: boolean;
	description: string;
	schema: Schema;
	style?: string;
	explode?: boolean;
}
export interface Response {
	description?: string;
	$ref?: string;
	content?: Record<string, { schema: Schema }>;
	headers?: Record<string, { description: string; schema: Schema }>;
}
export interface Operation {
	operationId: string;
	summary: string;
	description: string;
	tags: string[];
	security: Record<string, string[]>[];
	parameters: Parameter[];
	responses: Record<string, Response>;
	requestBody?: {
		required: boolean;
		content: Record<string, { schema: Schema }>;
	};
	'x-required-role'?: string;
}
interface Options {
	id: string;
	summary: string;
	description?: string;
	tag: string;
	access?: 'public' | 'viewer' | 'session' | 'admin';
	body?: string;
	result?: string;
	status?: number;
	mutates?: boolean;
	parameters?: Parameter[];
	errors?: number[];
	responses?: Record<string, Response>;
	cookie?: boolean;
}

/** @brief Converts an actual Zod input shape without documenting transformed output as input. @param schema Input validator. @return JSON Schema. */
export function input(schema: z.ZodType): Schema {
	const { $schema: _dialect, ...shape } = z.toJSONSchema(schema, {
		io: 'input'
	});
	return shape;
}

/** @brief Refers to a named component schema. @param name Component name. @return Local reference. */
export function ref(name: string): Schema {
	return { $ref: `#/components/schemas/${name}` };
}

/** @brief Describes a JSON response. @param name Schema name. @param description Response semantics. @return Response object. */
export function json(name: string, description = 'Successful response.'): Response {
	return {
		description,
		content: { 'application/json': { schema: ref(name) } }
	};
}

const errorDescriptions: Record<number, string> = {
	400: 'Invalid JSON, query, input fields or domain rules.',
	401: 'Missing, expired or revoked session, invalid credentials or rejected factor.',
	403: 'Untrusted/missing Origin or insufficient role.',
	404: 'Missing or unavailable resource; unpublished resources remain masked.',
	405: 'Method not allowed; Allow lists supported methods.',
	409: 'Conflicting state, duplicate identity/slug or changed saved usage.',
	413: 'Request body exceeds the byte limit.',
	429: 'Process-local quota exceeded; back off. Quotas are not shared across replicas.',
	500: 'Generic internal failure; no stack trace or credentials are returned.',
	502: 'Storage operation failed; inspect operation-specific recovery instructions.',
	503: 'Required service, storage capability or configuration unavailable.'
};
export const errorResponses: Record<string, Response> = Object.fromEntries(
	Object.entries(errorDescriptions).map(([status, description]) => [
		`Error${status}`,
		{
			...json('Error', description),
			...(status === '429'
				? {
						headers: {
							'Retry-After': {
								description: 'Seconds before retry.',
								schema: { type: 'integer', minimum: 1 }
							}
						}
					}
				: {})
		}
	])
);

/** @brief Reuses a transport error response without duplicating it in every operation. @param status HTTP failure status. @return Local response reference. */
function error(status: number): Response {
	return { $ref: `#/components/responses/Error${status}` };
}

/** @brief Describes a bounded scalar or repeated query parameter. @param name Query field. @param schema Value shape. @param description Parsing semantics. @return Parameter object. */
export function query(name: string, schema: Schema, description: string): Parameter {
	return {
		name,
		in: 'query',
		required: false,
		description,
		schema,
		...(schema['type'] === 'array' ? { style: 'form', explode: true } : {})
	};
}

/** @brief Describes a required resource path segment. @param name Segment name. @param schema Value shape. @param description Lookup semantics. @return Parameter object. */
export function path(name: string, schema: Schema, description: string): Parameter {
	return { name, in: 'path', required: true, description, schema };
}

/** @brief Builds documented success and failure responses. @param options Verified operation metadata. @return Responses by HTTP status. */
function operationResponses(options: Options): Record<string, Response> {
	const access = options.access ?? 'public';
	const responses: Record<string, Response> = {
		'405': error(405),
		'429': error(429),
		'500': error(500)
	};
	for (const status of options.errors ?? []) responses[status] = error(status);
	if (access === 'admin' || access === 'session') responses['401'] = error(401);
	if (access === 'admin' || options.mutates) responses['403'] = error(403);
	if (options.body) {
		responses['400'] ??= error(400);
		responses['413'] = error(413);
	}
	const success: Response = options.result
		? json(options.result)
		: { description: 'Success; no response body.' };
	if (options.cookie)
		success.headers = {
			'Set-Cookie': {
				description: 'HttpOnly SameSite=Lax cookie, Secure in production. Never log its value.',
				schema: { type: 'string' }
			}
		};
	responses[options.status ?? 200] = success;
	return { ...responses, ...options.responses };
}

const origin: Parameter = {
	name: 'Origin',
	in: 'header',
	required: true,
	description:
		'Exact configured trusted origin (scheme, host and port); not the request-derived Host.',
	schema: { type: 'string', format: 'uri', example: 'https://benchcore.example' }
};

/** @brief Builds an endpoint with shared transport, Origin and cookie requirements. @param options Verified operation metadata. @return OpenAPI operation. */
export function operation(options: Options): Operation {
	const access = options.access ?? 'public';
	return {
		operationId: options.id,
		summary: options.summary,
		description: options.description ?? options.summary,
		tags: [options.tag],
		security:
			access === 'public' ? [] : access === 'viewer' ? [{}, { session: [] }] : [{ session: [] }],
		parameters: [...(options.parameters ?? []), ...(options.mutates ? [origin] : [])],
		responses: operationResponses(options),
		...(options.body
			? {
					requestBody: {
						required: true,
						content: { 'application/json': { schema: ref(options.body) } }
					}
				}
			: {}),
		...(access === 'admin' ? { 'x-required-role': 'admin' } : {})
	};
}
