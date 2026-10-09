/**
 * @file common.it.ts
 * @brief Italian strings shared by every page: shell, navigation, themes, language and cookie notice.
 */
import type { commonEn } from './common.en.js';

export const commonIt: Record<keyof typeof commonEn, string> = {
	'common.dateUnavailable': 'Data non disponibile',
	'common.skipToContent': 'Vai al contenuto',
	'common.mainNavigation': 'Navigazione principale',
	'common.footer.license': 'Open source AGPL-3.0',
	'common.footer.licenseText': 'Licenza',
	'common.footer.cookies': 'Cookie',
	'nav.home': 'Home',
	'nav.posts': 'Articoli',
	'nav.topics': 'Argomenti',
	'nav.connections': 'Collegamenti',
	'nav.signIn': 'Accedi',
	'nav.createAccount': 'Crea account',
	'nav.account': 'Il mio account',
	'nav.administration': 'Amministrazione',
	'nav.newPost': 'Nuovo articolo',
	'nav.manageTags': 'Gestisci tag',
	'nav.manageUsers': 'Gestisci utenti',
	'nav.reviewComments': 'Modera commenti',
	'nav.auth.admin': 'admin',
	'nav.auth.account': 'account',
	'nav.auth.login': 'accesso',
	'theme.mode': 'TEMA:',
	'theme.light': 'chiaro',
	'theme.dark': 'scuro',
	'theme.oled': 'oled',
	'lang.label': 'LINGUA:',
	'lang.groupLabel': 'Lingua',
	'lang.switchTo': 'Cambia lingua in {name}',
	'cookieNotice.title': 'Vuoi un cookie?',
	'cookieNotice.stamp': 'SOLO ESSENZIALI',
	'cookieNotice.body':
		'Solo quelli utili. Un cookie di accesso esiste finché sei connesso, e lingua e tema vengono ricordati in questo browser. Niente pubblicità, niente analytics, niente tracciamento.',
	'cookieNotice.accept': 'Ho capito',
	'cookieNotice.details': 'Dettagli'
};
