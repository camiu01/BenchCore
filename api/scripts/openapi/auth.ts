/**
 * @file auth.ts
 * @brief Existing cookie authentication, account and TOTP contracts.
 */
import { z } from 'zod';
import { loginSchema } from '../../src/auth/credentials.js';
import {
	registrationSchema,
	passwordChangeSchema,
	userPatchSchema
} from '../../src/auth/accounts.js';
import { passwordResetRequestSchema, passwordResetSchema } from '../../src/auth/password-reset.js';
import { factorPasswordSchema, factorConfirmationSchema } from '../../src/auth/totp.js';
import { factorRemovalSchema } from '../../src/auth/factor-service.js';
import { input, operation, path, query, type Paths } from './helpers.js';
import { uuid } from './schemas.js';

export const authSchemas = {
	Login: {
		...input(loginSchema),
		oneOf: [{ required: ['email'] }, { required: ['username'] }],
		description:
			'Exactly one identifier; the legacy email field also accepts a username. A fresh six-digit code is required when TOTP is enabled.'
	},
	Registration: input(registrationSchema),
	CreateUser: input(registrationSchema.extend({ role: z.enum(['admin', 'reader']) })),
	PasswordChange: {
		...input(passwordChangeSchema),
		description: 'The new password must differ from the current password.'
	},
	PasswordResetRequest: input(passwordResetRequestSchema),
	PasswordReset: input(passwordResetSchema),
	UserPatch: { ...input(userPatchSchema), minProperties: 1 },
	FactorPassword: input(factorPasswordSchema),
	FactorConfirmation: input(factorConfirmationSchema),
	FactorRemoval: input(factorRemovalSchema)
};
const tag = 'Authentication';
const userId = path('id', input(uuid), 'Account UUID.');
export const authPaths: Paths = {
	'/api/auth/login': {
		post: operation({
			id: 'login',
			summary: 'Create a session',
			tag,
			mutates: true,
			body: 'Login',
			result: 'UserResult',
			cookie: true,
			errors: [401],
			description:
				'Username/email and password authentication; enabled factors require a fresh, non-replayed code. Sets the session cookie for 30 days.'
		})
	},
	'/api/auth/register': {
		post: operation({
			id: 'register',
			summary: 'Register a reader',
			tag,
			mutates: true,
			body: 'Registration',
			result: 'UserResult',
			status: 201,
			errors: [409],
			description:
				'Always creates a reader. Unknown fields, including role, are rejected. Does not log in or verify the email address.'
		})
	},
	'/api/auth/me': {
		get: operation({
			id: 'getSessionUser',
			summary: 'Read the current user',
			tag,
			access: 'session',
			result: 'UserResult'
		})
	},
	'/api/auth/logout': {
		post: operation({
			id: 'logout',
			summary: 'Revoke the presented session',
			tag,
			mutates: true,
			result: 'Ok',
			cookie: true,
			description: 'Idempotent, including without a current session. Clears the session cookie.'
		})
	},
	'/api/auth/logout/all': {
		post: operation({
			id: 'logoutAll',
			summary: 'Revoke all device sessions',
			tag,
			access: 'session',
			mutates: true,
			result: 'Ok',
			cookie: true
		})
	},
	'/api/auth/password': {
		post: operation({
			id: 'changePassword',
			summary: 'Rotate own password',
			tag,
			access: 'session',
			mutates: true,
			body: 'PasswordChange',
			result: 'Ok',
			cookie: true,
			description:
				'Requires the current password. Revokes every owner session and outstanding recovery token; sign in again.'
		})
	},
	'/api/auth/password/forgot': {
		post: operation({
			id: 'requestPasswordReset',
			summary: 'Request a recovery link',
			tag,
			mutates: true,
			body: 'PasswordResetRequest',
			result: 'Ok',
			status: 202,
			errors: [503],
			description:
				'Generic acceptance for any valid email, without account enumeration or delivery guarantees. Requires configured delivery; unavailable in the unified Node runtime.'
		})
	},
	'/api/auth/password/reset': {
		post: operation({
			id: 'resetPassword',
			summary: 'Consume a recovery token',
			tag,
			mutates: true,
			body: 'PasswordReset',
			result: 'Ok',
			description:
				'Consumes an unexpired, one-hour, single-use token and revokes every owner session. Does not remove TOTP.'
		})
	},
	'/api/auth/totp': {
		get: operation({
			id: 'getTotpStatus',
			summary: 'Read nonsecret factor state',
			tag,
			access: 'admin',
			result: 'FactorStatus'
		})
	},
	'/api/auth/totp/enroll': {
		post: operation({
			id: 'enrollTotp',
			summary: 'Begin administrator enrollment',
			tag,
			access: 'admin',
			mutates: true,
			body: 'FactorPassword',
			result: 'Enrollment',
			errors: [409, 503],
			description:
				'Password-confirmed setup valid for ten minutes. Returns a secret, encrypted owner-bound ticket and otpauth URI: never log or cache them. Requires configured factor encryption.'
		})
	},
	'/api/auth/totp/enable': {
		post: operation({
			id: 'enableTotp',
			summary: 'Activate an enrolled factor',
			tag,
			access: 'admin',
			mutates: true,
			body: 'FactorConfirmation',
			result: 'Ok',
			errors: [409, 503],
			cookie: true,
			description:
				'Requires password, live setup ticket and fresh TOTP. Revokes every session; sign in again with TOTP.'
		})
	},
	'/api/auth/totp/disable': {
		post: operation({
			id: 'disableTotp',
			summary: 'Remove an enabled factor',
			tag,
			access: 'admin',
			mutates: true,
			body: 'FactorRemoval',
			result: 'Ok',
			errors: [409, 503],
			cookie: true,
			description:
				'Requires password and a fresh, non-replayed code. Revokes every session. Offline recovery is a separate operator CLI, not an HTTP endpoint.'
		})
	},
	'/api/admin/users': {
		get: operation({
			id: 'listUsers',
			summary: 'List accounts',
			tag: 'Administration',
			access: 'admin',
			result: 'UserPage',
			errors: [400],
			parameters: [
				query(
					'limit',
					{ type: 'integer', minimum: 1, maximum: 100, default: 25 },
					'Maximum page size.'
				),
				query(
					'offset',
					{ type: 'integer', minimum: 0, maximum: 100000, default: 0 },
					'Offset into current results.'
				)
			]
		}),
		post: operation({
			id: 'createUser',
			summary: 'Create an account with an explicit role',
			tag: 'Administration',
			access: 'admin',
			mutates: true,
			body: 'CreateUser',
			result: 'UserResult',
			status: 201,
			errors: [409]
		})
	},
	'/api/admin/users/{id}': {
		patch: operation({
			id: 'manageUser',
			summary: 'Change account role or activation',
			tag: 'Administration',
			access: 'admin',
			mutates: true,
			parameters: [userId],
			body: 'UserPatch',
			result: 'UserResult',
			errors: [404, 409],
			description:
				'At least one field is required. Revokes privilege-bearing sessions; 409 protects the last active administrator. Invalid UUID returns 400.'
		})
	}
};
