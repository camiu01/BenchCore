/**
 * @file publishing.ts
 * @brief Categories, create-only imports and explicitly approved newsletter delivery.
 */
import { z } from 'zod';
import { vaultImportSchema } from '../../src/posts/obsidian-source.js';
import {
	subscriptionSchema,
	confirmationSchema,
	unsubscribeSchema,
	campaignSchema,
	sendSchema
} from '../../src/newsletter/service.js';
import { input, json, operation, type Paths } from './helpers.js';

export const publishingSchemas = {
	CategoryChange: input(
		z
			.object({
				name: z.string().trim().min(1).max(80),
				replacement: z.string().trim().min(1).max(80).nullable()
			})
			.strict()
	),
	VaultImport: {
		...input(vaultImportSchema),
		description:
			'At most 500 files and 2,000,000 aggregate UTF-8 source bytes. Paths must be safe vault-relative paths: no backslashes, absolute paths, colon, empty, dot or parent segments.'
	},
	Subscription: input(subscriptionSchema),
	Confirmation: input(confirmationSchema),
	Unsubscribe: input(unsubscribeSchema),
	CampaignInput: {
		...input(campaignSchema),
		description: 'Subject must not contain CR or LF. Saving never sends email.'
	},
	SendNewsletter: input(sendSchema)
};
export const publishingPaths: Paths = {
	'/api/categories': {
		get: operation({
			id: 'listCategories',
			summary: 'Read published category counts',
			tag: 'Posts',
			result: 'Categories'
		})
	},
	'/api/admin/categories': {
		get: operation({
			id: 'listAdminCategories',
			summary: 'Read all category assignments',
			tag: 'Administration',
			access: 'admin',
			result: 'Categories'
		}),
		post: operation({
			id: 'replaceCategory',
			summary: 'Rename or clear a category',
			tag: 'Administration',
			access: 'admin',
			mutates: true,
			body: 'CategoryChange',
			result: 'Changed',
			description:
				'A null replacement clears assignments. Posts are never deleted; changed reports affected rows.'
		})
	},
	'/api/admin/imports/obsidian': {
		post: operation({
			id: 'importObsidianVault',
			summary: 'Import a bounded vault without overwriting posts',
			tag: 'Administration',
			access: 'admin',
			mutates: true,
			body: 'VaultImport',
			result: 'VaultResult',
			description:
				'JSON notes, not a raw ZIP. Body cap 4,000,000 bytes. Aggregate source cap 2,000,000 UTF-8 bytes. private creates drafts; readers/public publish with corresponding audience. Inspect per-file errors/warnings even after HTTP 200. Existing slugs are not overwritten.'
		})
	},
	'/api/newsletter': {
		get: operation({
			id: 'getNewsletterStatus',
			summary: 'Read newsletter availability',
			tag: 'Newsletter',
			result: 'Availability'
		})
	},
	'/api/newsletter/subscribe': {
		post: operation({
			id: 'subscribeNewsletter',
			summary: 'Request explicit newsletter consent',
			tag: 'Newsletter',
			mutates: true,
			body: 'Subscription',
			result: 'Accepted',
			status: 202,
			errors: [503],
			description:
				'Requires consent=true. Leave website empty. Generic acceptance hides subscriber existence and SMTP failure. Confirmation expires after 24 hours. Requires configured delivery; unavailable in the unified runtime.'
		})
	},
	'/api/newsletter/confirm': {
		post: operation({
			id: 'confirmNewsletter',
			summary: 'Consume a single-use confirmation token',
			tag: 'Newsletter',
			mutates: true,
			body: 'Confirmation',
			result: 'Accepted',
			errors: [503],
			responses: {
				'400': {
					description:
						'Invalid shape returns Error; a well-shaped rejected/expired token returns accepted=false.',
					content: {
						'application/json': {
							schema: {
								oneOf: [
									{ $ref: '#/components/schemas/Error' },
									{ $ref: '#/components/schemas/Accepted' }
								]
							}
						}
					}
				}
			}
		})
	},
	'/api/newsletter/unsubscribe': {
		post: operation({
			id: 'unsubscribeNewsletter',
			summary: 'Revoke consent without an account',
			tag: 'Newsletter',
			mutates: true,
			body: 'Unsubscribe',
			result: 'Accepted',
			errors: [503],
			description:
				'Requires a valid signed token. Valid signatures return acceptance without exposing subscriber existence.',
			responses: {
				'400': {
					description: 'Invalid shape returns Error; a rejected signature returns accepted=false.',
					content: {
						'application/json': {
							schema: {
								oneOf: [
									{ $ref: '#/components/schemas/Error' },
									{ $ref: '#/components/schemas/Accepted' }
								]
							}
						}
					}
				}
			}
		})
	},
	'/api/admin/newsletter': {
		get: operation({
			id: 'listNewsletterCampaigns',
			summary: 'Read campaign previews and private counts',
			tag: 'Newsletter',
			access: 'admin',
			result: 'NewsletterDashboard',
			errors: [503]
		}),
		post: operation({
			id: 'createNewsletterCampaign',
			summary: 'Save an immutable campaign draft without sending',
			tag: 'Newsletter',
			access: 'admin',
			mutates: true,
			body: 'CampaignInput',
			result: 'Campaign',
			status: 201,
			errors: [503]
		})
	},
	'/api/admin/newsletter/send': {
		post: operation({
			id: 'sendNewsletterBatch',
			summary: 'Send one explicitly approved batch',
			tag: 'Newsletter',
			access: 'admin',
			mutates: true,
			body: 'SendNewsletter',
			result: 'NewsletterStats',
			errors: [404, 503],
			description:
				'Requires confirmation SEND for every action. Snapshots at most 1000 opted-in recipients and claims at most five per batch. No automatic sending or retry of in-flight claims. Concurrent requests may send different batches; invoke deliberately.',
			responses: {
				'503': json('Error', 'Newsletter repository/delivery is unavailable.')
			}
		})
	}
};
