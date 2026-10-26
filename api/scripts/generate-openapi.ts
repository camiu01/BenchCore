/**
 * @file generate-openapi.ts
 * @brief Generates the HTTP contract offline, without environment files or external services.
 */
import { writeFile } from 'node:fs/promises';
import { serializeOpenApi } from './openapi/document.js';

await writeFile(new URL('../../docs/openapi.json', import.meta.url), serializeOpenApi());
process.stdout.write(
	'Generated docs/openapi.json from current HTTP schemas and operation descriptions.\n'
);
