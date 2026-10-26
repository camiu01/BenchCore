/**
 * @file openapi.test.ts
 * @brief OpenAPI validity, regeneration drift, router coverage and mutation security.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import SwaggerParser from '@apidevtools/swagger-parser';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { openapi, serializeOpenApi } from '../scripts/openapi/document.js';
import type { Operation } from '../scripts/openapi/helpers.js';

const artifact = new URL('../../docs/openapi.json', import.meta.url);
const source = ts.createSourceFile(
	'server.ts',
	readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8'),
	ts.ScriptTarget.Latest,
	true
);

/** @brief Expands the router's bounded regex grammar into parameterized path shapes. @param expression Route regex source. @return Normalized paths. */
function expandRoute(expression: string): string[] {
	const normalized = expression
		.replace(/^\^|\$$/g, '')
		.replaceAll('\\/', '/')
		.replaceAll('([^/]+)', '{resource}');
	const group = /\(\?:([^()]+)\)(\?)?/.exec(normalized);
	if (!group) {
		if (/[()?]/.test(normalized)) throw new Error(`Unsupported router expression: ${expression}`);
		return [normalized];
	}
	const choices = group[1]!.split('|');
	if (group[2]) choices.push('');
	return choices.flatMap((choice) => expandRoute(normalized.replace(group[0], choice)));
}

/** @brief Reads a static route object and expands its methods. @param route Route syntax. @return Method/path pairs. */
function routeOperations(route: ts.Node): string[] {
	if (!ts.isObjectLiteralExpression(route)) throw new Error('Nonliteral route');
	const properties = route.properties.filter(ts.isPropertyAssignment);
	const regex = properties
		.find((property) => property.name.getText(source) === 'path')
		?.initializer.getText(source);
	const handlers = properties.find(
		(property) => property.name.getText(source) === 'handlers'
	)?.initializer;
	if (!regex || !handlers || !ts.isObjectLiteralExpression(handlers))
		throw new Error('Unsupported route registration');
	const paths = expandRoute(regex.slice(1, -1));
	return handlers.properties.flatMap((method) => {
		if (!ts.isPropertyAssignment(method)) throw new Error('Unsupported handler');
		return paths.map((path) => `${method.name.getText(source)} ${path}`);
	});
}

/** @brief Reads actual static route registrations without exporting runtime internals. @return Method/path pairs. */
function routerOperations(): string[] {
	const operations = ['GET /health'];
	/** @brief Visits the router declaration only. @param node TypeScript syntax node. @return Nothing. */
	function visit(node: ts.Node): void {
		if (!ts.isVariableDeclaration(node) || node.name.getText(source) !== 'routes') {
			ts.forEachChild(node, visit);
			return;
		}
		if (!node.initializer || !ts.isArrayLiteralExpression(node.initializer))
			throw new Error('Nonliteral route inventory');
		operations.push(...node.initializer.elements.flatMap(routeOperations));
	}
	visit(source);
	return operations.sort();
}
/** @brief Flattens documented operations for router and security checks. @return Method/path/operation records. */
function documentedOperations(): {
	key: string;
	method: string;
	operation: Operation;
}[] {
	return Object.entries(openapi.paths).flatMap(([path, methods]) =>
		Object.entries(methods).map(([method, operation]) => ({
			key: `${method.toUpperCase()} ${path.replace(/\{[^}]+\}/g, '{resource}')}`,
			method,
			operation
		}))
	);
}

describe('current OpenAPI contract', () => {
	it('is a valid, fully resolved OpenAPI 3.1 document', async () => {
		const document = await SwaggerParser.validate(fileURLToPath(artifact), {
			resolve: { external: false }
		});
		expect('openapi' in document && document.openapi).toBe('3.1.0');
	});

	it('matches deterministic generation from current schemas', () => {
		expect(readFileSync(artifact, 'utf8')).toBe(serializeOpenApi());
	});

	it('covers every routed method and every expanded path, without inventing endpoints', () => {
		expect(
			documentedOperations()
				.map(({ key }) => key)
				.sort()
		).toEqual(routerOperations());
	});

	it('has unique operation IDs and explicit authentication and Origin requirements', () => {
		const operations = documentedOperations();
		const ids = operations.map(({ operation }) => operation.operationId);
		expect(new Set(ids).size).toBe(ids.length);
		for (const { key, method, operation } of operations) {
			if (['post', 'put', 'patch', 'delete'].includes(method)) {
				expect(operation.parameters, key).toContainEqual(
					expect.objectContaining({
						name: 'Origin',
						in: 'header',
						required: true
					})
				);
			}
			if (key.includes('/api/admin/')) {
				expect(operation.security, key).toEqual([{ session: [] }]);
				expect(operation['x-required-role'], key).toBe('admin');
			}
			expect(operation.responses['204']?.content, key).toBeUndefined();
		}
	});

	it('preserves the slug/UUID distinction on the shared detail path', () => {
		const path = openapi.paths['/api/posts/{post}'];
		expect(path?.['get']?.parameters[0]?.schema).toEqual({ type: 'string' });
		expect(path?.['put']?.parameters[0]?.schema['format']).toBe('uuid');
		expect(path?.['delete']?.parameters[0]?.schema['format']).toBe('uuid');
	});
});
