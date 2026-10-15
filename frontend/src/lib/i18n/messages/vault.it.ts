/** @file vault.it.ts @brief Italian Obsidian import vocabulary. */
export const vaultIt = {
	'vault.title': 'Importa vault Obsidian',
	'vault.help': 'Porta le note Markdown e i loro collegamenti in BenchCore.',
	'vault.limits':
		'Carica uno ZIP del vault oppure seleziona più file Markdown. Massimo 500 note, 200 KB per nota, 2 MB per lo ZIP e 2 MB totali di Markdown. I post esistenti non vengono sovrascritti.',
	'vault.attachments':
		'Vengono importate solo le note Markdown. Impostazioni, cartelle nascoste e allegati vengono ignorati. I file incorporati non vengono caricati. I link alle sezioni aprono direttamente il titolo corrispondente nella nota di destinazione.',
	'vault.file': 'ZIP del vault o file Markdown',
	'vault.selectionHelp':
		'Seleziona più file .md con Ctrl o Maiusc, oppure un solo ZIP. Non mescolare ZIP e Markdown. Per mantenere le sottocartelle usa lo ZIP.',
	'vault.visibility': 'Visibilità di tutte le note importate',
	'vault.private': 'Privato, bozze riservate agli amministratori',
	'vault.readers': 'Pubblicato, solo lettori autenticati',
	'vault.public': 'Pubblicato, visibile a tutti',
	'vault.visibilityHelp':
		'Le note private restano nel pannello admin. Le altre opzioni pubblicano subito. Titolo e descrizione dei post per lettori autenticati possono essere visibili ai visitatori, ma non il contenuto.',
	'vault.confirm': 'Ho controllato il contenuto del vault e confermo la visibilità scelta.',
	'vault.submit': 'Importa note',
	'vault.busy': 'Importazione in corso…',
	'vault.invalid':
		'Scegli un solo ZIP oppure file .md con nomi univoci entro i limiti, seleziona la visibilità e conferma. I file devono essere UTF-8.',
	'vault.failed':
		'Importazione non disponibile. Controlla il pannello admin prima di riprovare: alcune note potrebbero essere già state create.',
	'vault.result': '{count} note importate',
	'vault.resultHelp':
		'Controlla le note importate nel pannello admin. I file con errori non sono stati importati.',
	'vault.errors': 'File non importati',
	'vault.warnings': '{count} avvisi sui collegamenti',
	'vault.skipped': '{count} file ignorati',
	'vault.back': 'Pannello admin'
} as const;
