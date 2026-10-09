/**
 * @file messages.ts
 * @brief English and Italian texts for API responses that carry a human-readable message.
 */

/** Languages the API can answer in. */
export type ApiLocale = 'en' | 'it';

/** Each entry holds both languages so a missing translation is a compile error. */
export const apiMessages = {
	'body.empty': { en: 'invalid body: empty', it: 'Corpo della richiesta non valido: vuoto' },
	'body.invalid': { en: 'invalid body: invalid', it: 'Corpo della richiesta non valido: formato errato' },
	'body.too_large': { en: 'invalid body: too_large', it: 'Corpo della richiesta non valido: troppo grande' },
	'origin.untrusted': { en: 'untrusted request origin', it: 'Origine della richiesta non attendibile' },
	'media.unsupported': {
		en: 'unsupported media or upload size',
		it: 'Formato o dimensione del file non supportati'
	},
	'media.in_use': {
		en: 'Confirm deletion through the editor.',
		it: 'Conferma l\u2019eliminazione dall\u2019editor.'
	},
	'media.storage_failed': {
		en: 'Saved references removed, but storage deletion failed. Retry.',
		it: 'Riferimenti salvati rimossi, ma l\u2019eliminazione dallo storage \u00e8 fallita. Riprova.'
	},
	'upload.unavailable': { en: 'Upload service unavailable', it: 'Servizio di caricamento non disponibile' },
	'upload.rejected': { en: 'Upload completion rejected', it: 'Completamento del caricamento rifiutato' },
	'comment.submitted': {
		en: 'Comment submitted for moderation',
		it: 'Commento inviato in moderazione'
	},
	'auth.invalid_credentials': { en: 'invalid credentials', it: 'Credenziali non valide' },
	'account.register_invalid': {
		en: 'Valid identity and an 8+ character password are required',
		it: 'Servono un\u2019identit\u00e0 valida e una password di almeno 8 caratteri'
	},
	'account.unavailable': { en: 'Account details unavailable', it: 'Dati account non disponibili' },
	'account.password_invalid': {
		en: 'Use a different 8+ character password',
		it: 'Usa una password diversa di almeno 8 caratteri'
	},
	'account.password_wrong': {
		en: 'Current password is incorrect or account changed',
		it: 'La password attuale non \u00e8 corretta oppure l\u2019account \u00e8 cambiato'
	},
	'account.reset_invalid': {
		en: 'Reset link is invalid or expired',
		it: 'Il link di reimpostazione non \u00e8 valido o \u00e8 scaduto'
	},
	'account.last_admin': {
		en: 'Keep at least one active administrator',
		it: 'Mantieni almeno un amministratore attivo'
	},
	'post.slug_exists': { en: 'slug already exists: {slug}', it: 'Lo slug esiste gi\u00e0: {slug}' },
	'post.not_found': { en: 'post not found: {id}', it: 'Articolo non trovato: {id}' },
	'post.scheduled_draft': {
		en: 'scheduled posts must remain drafts until the job publishes them',
		it: 'Gli articoli programmati restano bozze finch\u00e9 il processo non li pubblica'
	},
	'post.illegal_transition': {
		en: 'illegal transition {from} -> {to}',
		it: 'Transizione non consentita: {from} -> {to}'
	}
} as const satisfies Record<string, Record<ApiLocale, string>>;

export type ApiMessageKey = keyof typeof apiMessages;
