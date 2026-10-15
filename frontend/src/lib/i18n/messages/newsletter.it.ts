/**
 * @file newsletter.it.ts
 * @brief Italian newsletter consent and manual publishing messages.
 */
export const newsletterIt = {
	'newsletter.title': 'Newsletter',
	'newsletter.data':
		'Il consenso alla newsletter è separato dagli account. Con l’iscrizione esplicita, l’applicazione salva indirizzo email, date di consenso e richiesta, hash del token di conferma e scadenza. Solo gli iscritti con consenso esplicito confermato ricevono messaggi. Disiscriversi rimuove il record di iscrizione e salta gli invii in coda; quelli già in corso potrebbero arrivare. I record degli invii conservano identificativi ed esiti, non indirizzi dei destinatari.',
	'newsletter.intro': 'Aggiornamenti occasionali, solo con il tuo consenso.',
	'newsletter.noAccount': 'Non serve un account',
	'newsletter.subscribe': 'Iscriviti',
	'newsletter.email': 'Indirizzo email',
	'newsletter.consent':
		'Acconsento a ricevere la newsletter BenchCore via email. Posso disiscrivermi in qualsiasi momento.',
	'newsletter.privacy':
		'Il tuo indirizzo serve a recapitare la newsletter. Conferma il link ricevuto via email entro 24 ore per attivare l’iscrizione. Creare un account non ti iscrive. Ogni newsletter contiene un link per disiscriversi.',
	'newsletter.requested':
		'Se l’indirizzo può essere iscritto, riceverai un’email di conferma. Controlla anche lo spam. Un’iscrizione già confermata non riceve un’altra conferma.',
	'newsletter.failed': 'Operazione non riuscita. Controlla i campi e riprova.',
	'newsletter.disabled': 'Invio email non configurato. Nessuna newsletter può essere inviata.',
	'newsletter.confirmTitle': 'Conferma iscrizione',
	'newsletter.unsubscribeTitle': 'Disiscriviti',
	'newsletter.confirmHelp': 'Premi il pulsante per attivare l’iscrizione che hai richiesto.',
	'newsletter.unsubscribeHelp':
		'Premi il pulsante per rimuovere il tuo indirizzo dalla newsletter. Il tuo account non viene modificato.',
	'newsletter.confirmed': 'La tua iscrizione alla newsletter è confermata.',
	'newsletter.unsubscribed': 'Hai annullato l’iscrizione alla newsletter.',
	'newsletter.invalidToken':
		'Link non valido, scaduto, già usato o temporaneamente non disponibile. Puoi richiedere una nuova iscrizione dalla pagina newsletter.',
	'newsletter.adminIntro':
		'Salva un’anteprima, controlla il messaggio e approva esplicitamente ogni gruppo di invii.',
	'newsletter.recipients': 'Iscrizioni esplicite confermate: {count}',
	'newsletter.draft': 'Nuova bozza',
	'newsletter.subject': 'Oggetto',
	'newsletter.body': 'Messaggio (testo semplice)',
	'newsletter.draftHelp':
		'Salvare non invia email. Incolla i link agli articoli pubblici che vuoi includere. Il contenuto non è modificabile dopo il salvataggio.',
	'newsletter.preview': 'Salva anteprima senza inviare',
	'newsletter.footerPreview': 'Ogni destinatario riceve anche un link personale per disiscriversi.',
	'newsletter.approve':
		'Ho controllato questa anteprima e approvo l’invio agli iscritti confermati.',
	'newsletter.typeSend': 'Scrivi SEND per approvare questo gruppo',
	'newsletter.sendBatch': 'Invia il prossimo gruppo (massimo 5)',
	'newsletter.counts':
		'In coda: {queued} · In corso: {sending} · Inviati: {sent} · Falliti: {failed} · Saltati: {skipped}',
	'newsletter.inflight':
		'Alcuni invii sono in corso o sono stati interrotti. Non vengono ritentati automaticamente, per evitare duplicati.',
	'newsletter.saved': 'Operazione completata. Controlla l’anteprima e i conteggi qui sotto.',
	'newsletter.empty':
		'Nessuna campagna. Salva una bozza per vedere l’anteprima della prima newsletter.',
	'newsletter.status.draft': 'Bozza',
	'newsletter.status.sending': 'Invio in corso',
	'newsletter.status.complete': 'Completata'
} as const;
