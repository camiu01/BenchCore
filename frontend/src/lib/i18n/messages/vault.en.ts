/** @file vault.en.ts @brief English Obsidian import vocabulary. */
export const vaultEn = {
	'vault.title': 'Import Obsidian vault',
	'vault.help': 'Bring Markdown notes and their links into BenchCore.',
	'vault.limits':
		'Upload a vault ZIP or select multiple Markdown files. Up to 500 notes, 200 KB per note, 2 MB ZIP and 2 MB Markdown total. Existing posts are never overwritten.',
	'vault.attachments':
		'Only Markdown notes are imported. Settings, hidden folders and attachments are skipped. Embedded files are not uploaded. Section links open the matching heading in the target note.',
	'vault.file': 'Vault ZIP or Markdown files',
	'vault.selectionHelp':
		'Select multiple .md files with Ctrl or Shift, or one ZIP. Do not mix ZIP and Markdown. Use ZIP to preserve subfolders.',
	'vault.visibility': 'Visibility for all imported notes',
	'vault.private': 'Private, administrator-only drafts',
	'vault.readers': 'Published, authenticated readers only',
	'vault.public': 'Published, everyone',
	'vault.visibilityHelp':
		'Private notes stay in the admin panel. The other options publish immediately. Reader-only posts can expose their title and description, but not their content, to visitors.',
	'vault.confirm': 'I have checked the vault contents and confirm the selected visibility.',
	'vault.submit': 'Import notes',
	'vault.busy': 'Importing, please wait…',
	'vault.invalid':
		'Choose one ZIP or uniquely named .md files within the limits, select visibility and confirm. Files must be UTF-8.',
	'vault.failed':
		'Import unavailable. Check the admin ledger before retrying: some notes may already have been created.',
	'vault.result': '{count} notes imported',
	'vault.resultHelp':
		'Review the imported notes in the admin panel. Files with errors were not imported.',
	'vault.errors': 'Files not imported',
	'vault.warnings': '{count} link warnings',
	'vault.skipped': '{count} files skipped',
	'vault.back': 'Admin panel'
} as const;
