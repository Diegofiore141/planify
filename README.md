# Planify

Planify è una Progressive Web App sviluppata in React per la gestione di eventi, attività, note e promemoria.

L’app permette agli utenti di registrarsi, accedere alla propria area personale, creare eventi privati, pubblici o su invito, visualizzarli in un calendario interattivo e ricevere notifiche/promemoria.

Il progetto è stato realizzato come applicazione web moderna utilizzando React, Firebase, Firestore, funzionalità PWA e Firebase Hosting.

## Link al progetto online

Il progetto è disponibile online tramite Firebase Hosting:

```txt
https://planify-df274.web.app
```

## Tecnologie utilizzate

- React
- Vite
- React Router
- Firebase Authentication
- Cloud Firestore
- Firebase Analytics
- Firebase Hosting
- FullCalendar
- TipTap
- Vite PWA
- CSS personalizzato
- Open-Meteo per le informazioni meteo

## Funzionalità principali

### Autenticazione

Planify utilizza Firebase Authentication per gestire:

- registrazione con email e password
- conferma password
- verifica email obbligatoria
- login
- logout
- accesso con Google
- recupero password

Dopo la registrazione, l’utente riceve una email di verifica. Finché l’indirizzo email non viene verificato, l’utente non può accedere alle pagine protette dell’applicazione.

### Area personale

Ogni utente autenticato accede a una dashboard personale da cui può raggiungere le principali sezioni dell’app:

- eventi
- attività
- calendario
- notifiche
- note
- esplora eventi

Le route principali sono protette tramite un componente `ProtectedRoute`, che impedisce l’accesso agli utenti non autenticati o con email non verificata.

### Gestione eventi

Planify permette di creare tre tipi di eventi:

- eventi privati
- eventi pubblici
- eventi su invito

Gli eventi privati sono visibili solo all’utente che li crea.

Gli eventi pubblici vengono salvati in una collezione condivisa e possono essere visualizzati dagli altri utenti nella pagina “Esplora eventi”.

Gli eventi su invito permettono al creatore di specificare una lista di email invitate.

### Eventi pubblici

Gli eventi pubblici sono visibili agli utenti autenticati nella pagina “Esplora eventi”.

Un utente può aggiungere un evento pubblico al proprio calendario personale. In questo caso viene creata una copia personale dell’evento, collegata alla versione ufficiale creata dal proprietario.

### Eventi su invito

Gli eventi su invito permettono al creatore di invitare altri utenti tramite email.

Gli utenti invitati possono:

- visualizzare l’invito
- accettare l’evento
- rifiutare l’evento
- aggiungerlo al proprio calendario
- modificarne la copia personale

### Copie personali degli eventi

Quando un utente aggiunge un evento pubblico o accetta un evento su invito, Planify crea una copia personale dell’evento.

La copia personale permette all’utente di personalizzare i dati dell’evento senza modificare la versione ufficiale del creatore.

Per distinguere la versione ufficiale dalla copia personale, l’app utilizza i dati presenti nelle collezioni ufficiali:

```txt
publicEvents/{eventId}.ownerId
inviteEvents/{eventId}.ownerId
```

Se l’utente modifica la propria copia personale, l’app segnala la presenza di modifiche personali e permette di ripristinare i dati originali del creatore.

### Calendario

Planify integra un calendario interattivo tramite FullCalendar.

Nel calendario vengono mostrati:

- eventi privati
- eventi pubblici aggiunti dall’utente
- eventi su invito accettati
- attività
- festività italiane

Dal calendario è possibile visualizzare e modificare gli elementi. Gli eventi con modifiche personali vengono segnalati anche nella vista calendario.

### Attività

L’app permette di gestire attività personali con:

- titolo
- scadenza
- priorità
- stato completato / non completato

Le attività vengono salvate nello spazio personale dell’utente e possono essere visualizzate anche nel calendario.

### Note

Planify include una sezione dedicata alle note personali con editor rich text basato su TipTap.

Le note permettono all’utente di salvare contenuti testuali formattati, cercarli e organizzarli all’interno della propria area privata.

### Meteo

Per gli eventi con luogo e data, l’app può mostrare informazioni meteo tramite Open-Meteo.

Questa funzionalità permette all’utente di avere un’informazione aggiuntiva utile nella gestione degli eventi.

### Notifiche e promemoria

Planify supporta notifiche locali del browser per i promemoria degli eventi.

L’utente può attivare un promemoria per un evento futuro e ricevere una notifica all’orario previsto, se il browser concede il permesso alle notifiche.

### PWA

Planify è configurata come Progressive Web App.

Il progetto include:

- manifest
- service worker
- supporto all’installazione
- fallback offline
- gestione base della cache
- supporto alle notifiche del browser

La configurazione PWA permette all’app di essere installata dal browser e di offrire un comportamento più simile a una applicazione nativa.

## Struttura dati Firestore

Le principali collezioni utilizzate sono:

```txt
users
publicEvents
inviteEvents
```

### Dati personali utente

I dati personali sono salvati sotto:

```txt
users/{uid}
```

All’interno dell’utente possono essere presenti sottocollezioni come:

```txt
users/{uid}/events
users/{uid}/tasks
users/{uid}/notes
```

### Eventi pubblici

Gli eventi pubblici ufficiali sono salvati in:

```txt
publicEvents
```

### Eventi su invito

Gli eventi ufficiali su invito sono salvati in:

```txt
inviteEvents
```

## Sicurezza

La sicurezza dell’applicazione è gestita tramite:

- Firebase Authentication
- verifica email obbligatoria
- route protette lato React
- regole Firestore configurate nella console Firebase
- separazione dei dati personali per utente

Gli utenti possono accedere solo ai propri dati personali. Gli eventi pubblici e su invito utilizzano regole dedicate per distinguere creatore, partecipanti e invitati.

## Installazione del progetto

Clonare il repository:

```bash
git clone <url-repository>
```

Entrare nella cartella del progetto:

```bash
cd planify
```

Installare le dipendenze:

```bash
npm install
```

Avviare il server di sviluppo:

```bash
npm run dev
```

Aprire il progetto nel browser all’indirizzo indicato dal terminale, solitamente:

```txt
http://localhost:5173
```

## Build di produzione

Per generare la build finale:

```bash
npm run build
```

Per visualizzare la build in locale:

```bash
npm run preview
```

## Deploy con Firebase Hosting

Il progetto è stato pubblicato tramite Firebase Hosting.

La cartella usata per il deploy è:

```txt
dist
```

Per effettuare un nuovo deploy dopo eventuali modifiche:

```bash
npm run build
firebase deploy
```

Il sito pubblicato è disponibile al seguente indirizzo:

```txt
https://planify-df274.web.app
```

## Configurazione Firebase

Il progetto utilizza Firebase per autenticazione, database, analytics e hosting.

Sono utilizzati:

- Firebase Authentication
- Cloud Firestore
- Firebase Analytics
- Firebase Hosting

La configurazione Firebase è presente nel file:

```txt
src/services/firebase.js
```

Questo file legge la configurazione dalle variabili d’ambiente di Vite. Prima di avviare il progetto, creare un file `.env` locale con i valori del proprio progetto Firebase:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

Il file `.env` non dovrebbe essere pubblicato nel repository. Le regole di sicurezza Firestore devono essere configurate separatamente nella console Firebase.

## Obiettivo del progetto

L’obiettivo di Planify è fornire una web app completa per organizzare eventi, attività, note e promemoria.

Il progetto mostra l’integrazione tra frontend React, autenticazione Firebase, database cloud, calendario interattivo, notifiche, PWA, hosting e gestione di eventi condivisi tra utenti.

Un aspetto centrale dell’app è la distinzione tra evento ufficiale del creatore e copia personale del partecipante, così da permettere agli utenti di personalizzare i propri eventi senza modificare i dati originali degli altri utenti.