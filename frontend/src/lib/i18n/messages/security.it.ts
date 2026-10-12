/**
 * @file security.it.ts
 * @brief Italian account security and audit vocabulary.
 */
import type { securityEn } from './security.en.js';

export const securityIt: Record<keyof typeof securityEn, string> = {
	'security.title': 'Sicurezza account',
	'security.description':
		'Gestisci le sessioni e l’autenticazione a due fattori degli amministratori.',
	'security.account': 'Account',
	'security.audit': 'Registro di sicurezza',
	'security.logoutAll': 'Esci da tutti i dispositivi',
	'security.logoutHelp': 'Revoca tutte le sessioni attuali. Dovrai accedere di nuovo.',
	'security.totp': 'Autenticazione a due fattori',
	'security.totpHelp':
		'Usa un’app TOTP con codici a sei cifre che cambiano ogni 30 secondi. L’attivazione e la rimozione disconnettono tutti i dispositivi.',
	'security.enabled': 'Attiva',
	'security.disabled': 'Non attiva',
	'security.unavailable':
		'La configurazione dei due fattori non è disponibile. Chiedi al gestore di configurare AUTH_TOTP_KEY.',
	'security.offline': 'Le impostazioni di sicurezza non sono disponibili. Riprova più tardi.',
	'security.password': 'Password attuale',
	'security.code': 'Codice dell’app di autenticazione',
	'security.loginCodeHelp': 'Richiesto solo se hai attivato l’autenticazione a due fattori.',
	'security.enroll': 'Configura l’app di autenticazione',
	'security.manualKey': 'Chiave di configurazione manuale',
	'security.qrLabel': 'Codice QR per configurare l’app di autenticazione',
	'security.qrHelp':
		'In Google Authenticator o in un’altra app TOTP, aggiungi un account e scansiona questo QR. Il QR contiene la tua chiave segreta: non condividerlo e non salvarlo in uno screenshot pubblico.',
	'security.setupHelp':
		'Scansiona il QR oppure inserisci la chiave manuale nella tua app, poi inserisci un codice e la password qui sotto. La configurazione scade dopo dieci minuti. Tieni privati il dispositivo e la chiave.',
	'security.enable': 'Conferma e attiva',
	'security.disable': 'Disattiva l’autenticazione a due fattori',
	'security.freshCode':
		'Dopo l’accesso attendi un nuovo codice. Ogni codice può essere usato una sola volta.',
	'security.auditHelp':
		'Cronologia con soli identificatori: modifiche agli account, rotazione password, revoca sessioni, moderazione ed eliminazione dei post. Credenziali e contenuti non vengono registrati.',
	'security.auditEmpty': 'Nessun evento di sicurezza in questa pagina.',
	'security.auditAction': 'Evento',
	'security.auditTime': 'Data',
	'security.auditActor': 'Autore',
	'security.auditTarget': 'Destinatario',
	'security.auditCount': 'Quantità',
	'security.operator': 'Gestore / sistema',
	'security.previous': 'Precedente',
	'security.next': 'Successiva',
	'security.bulkTitle': 'Elimina i record selezionati',
	'security.bulkHelp':
		'Seleziona i record in questa pagina e digita DELETE. L’eliminazione è definitiva e viene registrata nel registro di sicurezza.',
	'security.selectPost': 'Seleziona {title}',
	'security.confirmDelete': 'Digita DELETE per confermare',
	'security.deleteSelected': 'Elimina definitivamente i selezionati',
	'security.deleted': '{count} record eliminati.'
};
