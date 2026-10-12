/**
 * @file pages.it.ts
 * @brief Italian public information, recovery pages and footer vocabulary.
 */
import type { pagesEn } from './pages.en.js';

export const pagesIt: Record<keyof typeof pagesEn, string> = {
	'pages.footer.navigation': 'Informazioni sul sito e feed',
	'pages.about.label': 'Il progetto',
	'pages.help.label': 'Guida',
	'pages.privacy.label': 'Privacy',
	'pages.cookies.label': 'Cookie',
	'pages.rss.label': 'Feed RSS',
	'pages.sitemap.label': 'Mappa del sito',
	'pages.about.title': 'Il progetto BenchCore',
	'pages.about.description':
		'Appunti di ricerca, sistemi embedded ed esperimenti sui circuiti in un diario tecnico open source.',
	'pages.about.intro':
		'Bench-testing, Embedded Networks, & Circuit Hacks: Centralized Open-source Research Engine.',
	'pages.about.researchTitle': 'Uno spazio per gli appunti di ricerca',
	'pages.about.research':
		'BenchCore raccoglie appunti tecnici ed esperimenti in un archivio consultabile. Gli articoli si collegano attraverso argomenti, record correlati e link, così puoi seguire un’idea tra più pagine.',
	'pages.about.readingTitle': 'Leggi ed esplora',
	'pages.about.reading':
		'Sfoglia l’archivio, cerca un tema o esplora il grafo dei collegamenti. I record pubblici sono aperti a tutti. Alcuni articoli pubblicati richiedono un account lettore; bozze e record archiviati non sono pubblici.',
	'pages.about.sourceTitle': 'Software open source',
	'pages.about.source':
		'Il codice della piattaforma è disponibile con licenza GNU AGPL-3.0-or-later. Il sito usa SvelteKit, un’API TypeScript e PostgreSQL. Non include script pubblicitari o di analisi del traffico.',
	'pages.about.rights':
		'Per riutilizzare un articolo o un allegato, controlla la licenza indicata dall’autore. La licenza del software non è un’autorizzazione generale per ogni file caricato.',
	'pages.about.sourceLink': 'Consulta il codice',
	'pages.help.title': 'Guida alla lettura',
	'pages.help.description':
		'Trova articoli, segui i collegamenti, gestisci il tuo account e risolvi i problemi più comuni.',
	'pages.help.intro': 'Percorsi utili nell’archivio e indicazioni su account e commenti.',
	'pages.help.findTitle': 'Trova un record',
	'pages.help.find':
		'Cerca nell’archivio per titolo o argomento. Combina i filtri con AND per richiedere tutti i temi selezionati, oppure con OR per trovarne almeno uno. Puoi anche sfogliare gli argomenti o seguire i record connessi nel grafo.',
	'pages.help.accountTitle': 'Account e articoli riservati',
	'pages.help.account':
		'Crea un account lettore per aprire gli articoli riservati. Puoi cambiare la password in Account. Da Sicurezza account puoi uscire da tutti i dispositivi; gli amministratori possono anche configurare un’app di autenticazione.',
	'pages.help.recovery':
		'Hai dimenticato la password? Richiedi un link di recupero. Il recupero via email deve essere attivato dal gestore del sito. Se non è disponibile, chiedi aiuto al gestore. Non condividere password, cookie di sessione o link di recupero.',
	'pages.help.commentsTitle': 'Commenti e mi piace',
	'pages.help.comments':
		'I commenti entrano in una coda di moderazione e diventano pubblici solo dopo l’approvazione. Scrivi soltanto informazioni che vuoi condividere pubblicamente. I mi piace usano un cookie del sito, non un account pubblicitario.',
	'pages.help.feedTitle': 'Segui i nuovi record',
	'pages.help.feed':
		'Aggiungi il feed RSS al tuo lettore preferito per seguire gli articoli pubblicati. Gli articoli riservati possono comparire con il titolo pubblico, ma il testo protetto non viene incluso per gli ospiti.',
	'pages.help.problemTitle': 'Qualcosa non funziona?',
	'pages.help.problem':
		'Controlla la connessione e riprova. Un record mancante potrebbe essere stato spostato o non essere più pubblico. Per un problema del software, usa il registro delle segnalazioni del progetto e indica pagina, passaggi e uno screenshot senza informazioni private.',
	'pages.help.issuesLink': 'Segnala un problema del software',
	'pages.help.passwordLink': 'Recupera una password',
	'pages.help.accountLink': 'Apri il tuo account',
	'pages.privacy.title': 'Privacy e dati',
	'pages.privacy.description':
		'Cosa salva l’applicazione BenchCore, cosa rimane pubblico e come funzionano le preferenze del browser.',
	'pages.privacy.intro':
		'Questa pagina descrive la gestione dei dati dell’applicazione. I fornitori di hosting, email e archiviazione possono avere politiche proprie.',
	'pages.privacy.accountTitle': 'Dati dell’account e della sicurezza',
	'pages.privacy.account':
		'Un account contiene nome utente, email, nome visualizzato, ruolo e stato. Le password sono salvate come hash. Anche i token di sessione e recupero sono salvati come hash; le chiavi degli autenticatori degli amministratori sono cifrate.',
	'pages.privacy.audit':
		'Il registro di sicurezza contiene nomi degli eventi, identificatori di autore e destinatario, quantità e date. Non registra password, token, email, indirizzi IP o testi degli articoli. Solo gli amministratori possono consultarlo.',
	'pages.privacy.publicTitle': 'Contributi pubblici',
	'pages.privacy.public':
		'I commenti approvati mostrano nome, testo e data inviati. Anche gli articoli e gli allegati possono essere pubblici. Non inserire recapiti privati o segreti in un contributo destinato alla pubblicazione.',
	'pages.privacy.likes':
		'I mi piace salvano un hash derivato da un token del browser. I limiti dei commenti tengono temporaneamente in memoria indirizzi IP e hash dei token di sessione; questi contatori non fanno parte del registro di sicurezza.',
	'pages.privacy.browserTitle': 'Dati nel browser',
	'pages.privacy.browser':
		'I cookie del sito servono per accesso, scelta della lingua e mi piace. L’archiviazione locale ricorda il tema e la chiusura dell’avviso sui cookie. BenchCore non include script pubblicitari o di analisi del traffico.',
	'pages.privacy.providersTitle': 'Hosting e risorse esterne',
	'pages.privacy.providers':
		'Il server o il proxy possono conservare log degli accessi. Il recupero password, se attivo, invia email tramite il fornitore configurato. Le immagini possono provenire dall’archiviazione del sito o da un URL esterno; aprirle può inviare una richiesta a quel fornitore.',
	'pages.privacy.controlTitle': 'Le tue scelte',
	'pages.privacy.control':
		'Puoi uscire, revocare tutte le sessioni, cambiare password e cancellare i dati del browser. Cancellare i cookie non elimina l’account o i contributi pubblicati. Per la rimozione di account o contenuti, contatta il gestore di questa installazione; non esiste un modulo di eliminazione automatica.',
	'pages.privacy.warning':
		'Non pubblicare dati privati dell’account, password o link di recupero nel registro pubblico delle segnalazioni.',
	'pages.error.notFoundTitle': 'Pagina non trovata',
	'pages.error.notFoundDescription':
		'Questo indirizzo non corrisponde a una pagina pubblica. Riparti dall’archivio o cerca un record.',
	'pages.error.notFoundBody':
		'Il link potrebbe essere vecchio oppure il record potrebbe non essere più pubblico. Controlla l’indirizzo o scegli uno dei percorsi qui sotto.',
	'pages.error.unavailableTitle': 'Pagina non disponibile',
	'pages.error.unavailableDescription':
		'Non è stato possibile completare la richiesta. Riprova o torna all’archivio.',
	'pages.error.unavailableBody':
		'Il sito non ha completato la richiesta. Prova a ricaricare la pagina. Se il problema continua, consulta le indicazioni nella guida.',
	'pages.error.deniedTitle': 'Accesso non disponibile',
	'pages.error.deniedDescription': 'Il tuo account non può aprire questa pagina.',
	'pages.error.deniedBody': 'Accedi con un account autorizzato oppure torna all’archivio pubblico.',
	'pages.error.home': 'Torna all’indice',
	'pages.error.archive': 'Sfoglia gli articoli',
	'pages.error.searchLabel': 'Cerca nell’archivio',
	'pages.error.searchPlaceholder': 'Titolo o argomento',
	'pages.error.searchSubmit': 'Cerca',
	'pages.error.retry': 'Ricarica questa pagina',
	'pages.error.signIn': 'Accedi',
	'pages.cookies.likePurpose':
		'Ricorda se questo browser ha messo mi piace a un record. Creato al primo uso del pulsante mi piace.',
	'pages.cookies.likeDuration': 'Fino a 1 anno, o fino alla cancellazione dei dati del sito'
};
