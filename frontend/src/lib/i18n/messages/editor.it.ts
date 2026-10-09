/**
 * @file editor.it.ts
 * @brief Italian strings for the editor area.
 */
import type { editorEn } from './editor.en.js';

export const editorIt: Record<keyof typeof editorEn, string> = {
	'editor.field.title': 'Titolo',
	'editor.field.slug': 'URL dell’articolo (slug)',
	'editor.field.slugHelp':
		'Usa lettere minuscole, numeri e trattini, ad esempio il-mio-primo-articolo.',
	'editor.field.description': 'Breve riassunto',
	'editor.field.descriptionHelp':
		'Mostrato negli elenchi degli articoli e nelle anteprime di ricerca.',
	'editor.field.status': 'Stato',
	'editor.field.audience': 'Visibilità',
	'editor.field.tags': 'Tag (separati da virgola)',
	'editor.field.publishedAt': 'Pubblicato il (vuoto = automatico)',
	'editor.field.publishAt': 'Programma la pubblicazione (vuoto = nessuna)',
	'editor.field.cover': 'Immagine di copertina (URL o chiave media)',
	'editor.field.content': 'Contenuto (Markdown + [[wikilinks]])',
	'editor.field.contentUploadHint':
		'Posiziona il cursore dove vuoi le immagini, poi seleziona i file qui sotto o trascinali qui. Le immagini vengono inserite in automatico.',
	'editor.field.attachImage': 'Allega immagine (png/jpg/webp/gif, max 5 MiB)',
	'editor.status.draft': 'bozza',
	'editor.status.published': 'pubblicato',
	'editor.status.archived': 'archiviato',
	'editor.audience.public': 'Pubblico',
	'editor.audience.readers': 'Solo lettori e amministratori',
	'editor.schedulerDisabled':
		'La pubblicazione automatica è temporaneamente disattivata. Le programmazioni esistenti restano salvate: rimuovi la programmazione prima di pubblicare a mano.',
	'editor.action.save': 'Salva articolo →',
	'editor.action.preview': 'ANTEPRIMA',
	'editor.action.delete': 'Elimina articolo',
	'editor.action.upload': 'CARICA →',
	'editor.uploadedAt': 'Archiviato in',
	'editor.uploadedAppended': '(aggiunto al contenuto qui sopra).',
	'editor.preview.title': 'Anteprima dell’articolo',
	'editor.preview.note': 'Questa è un’anteprima. Salva l’articolo per mantenere le modifiche.',
	'editor.state.submitting': 'Invio in corso…',
	'editor.state.unsaved': 'Modifiche non salvate',
	'editor.state.notSaved': 'Non ancora salvato',
	'editor.state.saved': 'Nessuna modifica non salvata',
	'editor.state.autosaveOff': 'Il salvataggio automatico è disattivato.',
	'editor.state.leaveConfirm': 'Hai modifiche non salvate. Vuoi lasciare la pagina e perderle?',
	'editor.date.clear': 'CANCELLA',
	'editor.date.localTime': 'ora locale',
	'editor.date.storedUtc': '{timezone}; salvato in UTC.',
	'editor.wikilink.suggestions': 'Suggerimenti di articoli esistenti',
	'editor.copy.thisImage': 'questa immagine',
	'editor.copy.aria': 'Copia il link dell’immagine {name}',
	'editor.copy.copying': 'Copia in corso…',
	'editor.copy.copied': 'Copiato',
	'editor.copy.copy': 'Copia link',
	'editor.copy.done': 'Link copiato.',
	'editor.copy.clipboardUnavailable':
		'Gli appunti non sono disponibili. Seleziona e copia il link qui sotto.',
	'editor.copy.linkFailed': 'Impossibile creare il link di questa immagine.',
	'editor.copy.linkLabel': 'Link dell’immagine {name}',
	'editor.preview.enlarge': 'Ingrandisci l’immagine {name}',
	'editor.preview.dialog': 'Anteprima immagine: {name}',
	'editor.preview.close': 'Chiudi anteprima',
	'editor.preview.dimensions': '{width} × {height} px',
	'editor.preview.dimensionsUnavailable': 'Dimensioni non disponibili',
	'editor.preview.sizeUnavailable': 'Dimensione del file non disponibile',
	'editor.images.label': 'Immagini dell’articolo',
	'editor.images.banner': '// IMMAGINI DELL’ARTICOLO',
	'editor.images.intro':
		'Include le immagini esistenti e la copertina. Rimuovere un’immagine elimina anche il file archiviato in modo permanente, dopo conferma.',
	'editor.images.moveHelp':
		'I pulsanti di spostamento riordinano le immagini Markdown da sole su una riga. Didascalie, codice e altro testo restano invariati. Salva l’articolo per mantenere il nuovo ordine.',
	'editor.images.moveEarlierAria': 'Sposta l’immagine {key} prima',
	'editor.images.moveLaterAria': 'Sposta l’immagine {key} dopo',
	'editor.images.moveUp': 'Sposta su',
	'editor.images.moveDown': 'Sposta giù',
	'editor.images.currentCover': 'Copertina attuale',
	'editor.images.useAsCover': 'Usa come copertina',
	'editor.images.remove': 'RIMUOVI',
	'editor.images.confirmLabel': 'Conferma l’eliminazione permanente dell’immagine',
	'editor.images.confirmTitle': 'Eliminare questa immagine in modo permanente?',
	'editor.images.confirmBody':
		'Questo rimuove il file dall’archivio, ogni riferimento all’immagine e l’eventuale copertina corrispondente.',
	'editor.images.confirmUses':
		'Questi articoli salvati verranno aggiornati subito, anche senza premere Salva:',
	'editor.images.confirmNoUses':
		'Nessun articolo salvato usa questa immagine. Verranno rimossi anche i suoi riferimenti non salvati in questo editor.',
	'editor.images.cancel': 'ANNULLA',
	'editor.images.deleting': 'ELIMINAZIONE…',
	'editor.images.deleteAll': 'ELIMINA IL FILE E TUTTI I RIFERIMENTI',
	'editor.images.checking': 'Controllo dell’uso dell’immagine nei salvataggi…',
	'editor.images.checkFailed':
		'Impossibile controllare l’uso dell’immagine. Nessuna immagine è stata eliminata.',
	'editor.images.deleted':
		'Immagine eliminata definitivamente dall’archivio e rimossa dagli articoli salvati.',
	'editor.images.deleteFailed': 'Eliminazione dell’immagine non riuscita.',
	'editor.upload.label': 'Allega immagini (fino a 20 per lotto, 5 MiB ciascuna)',
	'editor.upload.tooMany':
		'Massimo 20 immagini per lotto. Sono state selezionate solo le prime 20.',
	'editor.upload.attached': '{done} immagini su {total} allegate. Salva il record per mantenerle.',
	'editor.upload.uploading': 'CARICAMENTO {done}/{total}…',
	'editor.upload.start': 'CARICA LE IMMAGINI SELEZIONATE →',
	'editor.upload.hint':
		'Seleziona più file o trascina le immagini sull’editor Markdown. Il primo caricamento riuscito diventa la copertina solo se il campo copertina è vuoto.',
	'editor.upload.queue': 'Coda di caricamento immagini',
	'editor.upload.inContent': 'NEL CONTENUTO',
	'editor.upload.queued': 'in coda',
	'editor.upload.uploadingStamp': 'in caricamento',
	'editor.upload.failed': 'non riuscito',
	'editor.upload.progressAria': 'Avanzamento del caricamento di {name}',
	'editor.upload.verifying': 'Verifica del caricamento',
	'editor.upload.moveEarlierAria': 'Sposta {name} prima',
	'editor.upload.moveLaterAria': 'Sposta {name} dopo',
	'editor.upload.noscript':
		'Il caricamento su R2 richiede JavaScript. I riferimenti alle immagini esistenti restano modificabili.',
	'editor.error.uploadFailed': 'Caricamento non riuscito.',
	'editor.error.invalidFile': 'Seleziona un’immagine png/jpg/webp/gif fino a 5 MiB.',
	'editor.error.authorization':
		'Autorizzazione al caricamento non riuscita. Controlla la sessione e la configurazione di R2.',
	'editor.error.verification': 'Verifica del caricamento non riuscita. Riprova a caricare.',
	'editor.error.r2Failed': 'Caricamento su R2 non riuscito. Controlla la policy CORS del bucket.',
	'editor.error.r2Timeout': 'Caricamento su R2 scaduto. Riprova a caricare.',
	'editor.error.r2Cancelled': 'Caricamento su R2 annullato.',
	'editor.error.inspectFailed': 'Impossibile controllare l’uso dell’immagine. Riprova.',
	'editor.error.usageChanged': 'L’uso dell’immagine è cambiato. Ricontrolla prima di eliminare.',
	'editor.error.storageDeleteFailed':
		'Eliminazione dall’archivio non riuscita. I riferimenti salvati potrebbero essere stati rimossi: riprova.',
	'editor.error.deleteRetry': 'Eliminazione dell’immagine non riuscita. Riprova.'
};
