/**
 * @file security.en.ts
 * @brief English account security and audit vocabulary.
 */
export const securityEn = {
	'security.title': 'Account security',
	'security.description': 'Manage device sessions and administrator two-factor authentication.',
	'security.account': 'Account',
	'security.audit': 'Security log',
	'security.logoutAll': 'Sign out on every device',
	'security.logoutHelp': 'Revokes all current sessions. You will need to sign in again.',
	'security.totp': 'Two-factor authentication',
	'security.totpHelp':
		'Use a TOTP authenticator with six-digit codes that change every 30 seconds. Activation and removal sign out every device.',
	'security.enabled': 'Enabled',
	'security.disabled': 'Not enabled',
	'security.unavailable':
		'Two-factor enrollment is unavailable. Ask your operator to configure AUTH_TOTP_KEY.',
	'security.offline': 'Security settings are unavailable. Try again later.',
	'security.password': 'Current password',
	'security.code': 'Authenticator code',
	'security.loginCodeHelp': 'Required only if you have enabled two-factor authentication.',
	'security.enroll': 'Set up authenticator',
	'security.manualKey': 'Manual setup key',
	'security.setupHelp':
		'Add this key to your authenticator, then enter a code and your password below. This setup expires in ten minutes. Keep your device and the setup key private.',
	'security.enable': 'Confirm and enable',
	'security.disable': 'Disable two-factor authentication',
	'security.freshCode': 'Wait for a new code after signing in. Each code can be used only once.',
	'security.auditHelp':
		'Identifier-only history of account changes, password rotation, session revocation, moderation and post deletion. Credentials and post bodies are never recorded.',
	'security.auditEmpty': 'No security events on this page.',
	'security.auditAction': 'Event',
	'security.auditTime': 'Time',
	'security.auditActor': 'Actor',
	'security.auditTarget': 'Target',
	'security.auditCount': 'Count',
	'security.operator': 'Operator / system',
	'security.previous': 'Previous',
	'security.next': 'Next',
	'security.bulkTitle': 'Delete selected records',
	'security.bulkHelp':
		'Select records on this page, then type DELETE. This permanently deletes the selection and records the operation in the security log.',
	'security.selectPost': 'Select {title}',
	'security.confirmDelete': 'Type DELETE to confirm',
	'security.deleteSelected': 'Permanently delete selected',
	'security.deleted': '{count} records deleted.'
} as const;
