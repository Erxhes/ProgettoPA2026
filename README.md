# Backend per modelli di ottimizzazione su grafo

Progetto individuale per l'esame di Programmazione Avanzata (A.A. 2025/2026, UNIVPM).

## Indice

1. [Obiettivo](#obiettivo)
2. [Stack](#stack)
3. [Rotte](#rotte)
4. [Progettazione](#progettazione)
5. [Decisioni di progetto](#decisioni-di-progetto)
6. [Errori](#errori)
7. [Dati iniziali (seed)](#dati-iniziali-seed)
8. [Avvio con docker-compose](#avvio-con-docker-compose)
9. [Test](#test)
10. [Test con Postman](#test-con-postman)
11. [Struttura del repository](#struttura-del-repository)

## Obiettivo

Il progetto è un back-end REST per creare, eseguire e valutare modelli di ottimizzazione su grafo. Un modello è un grafo con dei pesi sugli archi, e il percorso di costo minimo si calcola con [`node-dijkstra`](https://www.npmjs.com/package/node-dijkstra).

Simula il *crowd-sourcing*: ogni utente autenticato può proporre un nuovo peso per un arco (per esempio i minuti per percorrere un tratto di strada) e il proprietario del modello decide se accettarlo. Se la proposta è approvata, il peso viene aggiornato con una media esponenziale e nasce una nuova **versione dei pesi**.

Cosa si può fare:

- creare un modello da un grafo nel formato di `node-dijkstra`, pagando dei token;
- eseguire un modello e ottenere percorso, costo del percorso e tempo di esecuzione, pagando dei token;
- chiedere il cambio di peso di un arco: la richiesta parte in stato *pending* e poi diventa *approved* o *rejected* (con motivazione);
- consultare lo stato delle richieste e le versioni dei pesi, con dei filtri;
- simulare la variazione del peso di un arco e vedere il risultato migliore con la sua configurazione dei pesi;
- gestire i token di ogni utente, con una rotta riservata all'admin per la ricarica.

Tutte le rotte, tranne `GET /health`, sono protette da JWT RS256.

## Stack

| Componente | Scelta |
|---|---|
| Runtime e linguaggio | Node.js 24, TypeScript in modalità `strict` (senza `any`) |
| Web framework | Express 5 |
| ORM e database | Sequelize 6, PostgreSQL 16 (processo separato, avviato da docker-compose) |
| Grafo | `node-dijkstra` |
| Autenticazione | JWT con algoritmo RS256 (`jsonwebtoken`); la chiave privata è in `.env` |
| Validazione | `zod` |
| Test | Jest, ts-jest, supertest |
| Contenitori | Docker e docker-compose |
| Collaudo manuale | Postman (collection e ambiente in `postman/`) |

## Rotte

Tutte le rotte, tranne `GET /health`, richiedono l'header `Authorization: Bearer <JWT>` e passano dal controllo dei token residui:
se l'utente ha finito i token ogni richiesta restituisce **401**.

| Metodo e percorso | Chi può chiamarla | Descrizione |
|---|---|---|
| `GET /health` | pubblica | verifica che il servizio sia attivo |
| `POST /admin/recharge` | admin | ricarica un utente: body `{ email, credit }`, il credito si somma al saldo |
| `POST /models` | utente | crea un modello: body `{ name, graph }`; costo 0.20 per nodo + 0.01 per arco |
| `POST /models/:id/execute` | utente | esegue il modello: body `{ start, goal }`; stesso costo della creazione |
| `POST /models/:id/simulate` | utente | simula la variazione del peso di un arco (nessun costo in token) |
| `GET /models/:id/versions` | utente | versioni dei pesi; filtri `date`, `nodes`, `edges` |
| `POST /models/:id/weight-requests` | utente | crea una richiesta di cambio peso (stato `pending`) |
| `GET /weight-requests` | utente | stato delle richieste; filtri `modelId`, `date`, `status` (in AND) |
| `PATCH /weight-requests/:id/approve` | utente, se proprietario del modello | approva la richiesta e crea la nuova versione |
| `PATCH /weight-requests/:id/reject` | utente, se proprietario del modello | rifiuta la richiesta; body `{ reason }` obbligatorio |

### Formato del grafo

Il grafo segue l'interfaccia di `node-dijkstra`: un oggetto che ha per chiavi i nodi e per valori i vicini raggiungibili con il relativo peso.
Il grafo è orientato. Ogni vicino deve comparire anche come chiave (eventualmente con `{}`), così il numero di nodi è univoco.

```json
{
  "name": "Casa - Università",
  "graph": {
    "Casa": { "Fermata": 4, "Piazza": 2 },
    "Fermata": { "Piazza": 1, "Università": 5 },
    "Piazza": { "Università": 8 },
    "Università": {}
  }
}
```

Ogni nodo deve avere almeno un arco, entrante o uscente: i nodi di una versione si ricavano dagli archi, quindi un nodo isolato andrebbe perso e viene rifiutato con 400.

Vincoli: pesi numerici maggiori di 0 e minori di 1000000, al più 4 decimali; nessun arco da un nodo a se stesso; almeno un arco; al massimo 500 nodi e 5000 archi.

### Esempi di risposta

Esecuzione (`POST /models/1/execute`, body `{ "start": "Stazione", "goal": "Collemarino" }`):

```json
{
  "modelId": 1, "versionNumber": 2, "start": "Stazione", "goal": "Collemarino",
  "path": ["Stazione", "Porto", "Piazza Roma", "Duomo", "Passetto", "Montedago", "Collemarino"],
  "cost": 24.1,
  "executionTimeMs": 1.8,
  "tokensCharged": 2.58,
  "remainingTokens": 47.42
}
```

`cost` è la somma dei pesi lungo il percorso ottimo, **non** i token addebitati (che sono in `tokensCharged`).

Simulazione (`POST /models/1/simulate`):

```json
{
  "start": "Stazione", "goal": "Collemarino",
  "edge": { "from": "Piazza Roma", "to": "Duomo" },
  "initialWeight": 1, "finalWeight": 2, "step": 0.05
}
```

La risposta contiene `results` (peso, percorso e costo per ognuno dei 21 passi), `best` (il risultato con il costo minore,
con `weights`, cioè la configurazione completa dei pesi del grafo usata) e `executionTimeMs`.

### Filtri

- `date` è un giorno nel formato `YYYY-MM-DD` (UTC): restituisce gli elementi creati in quel giorno. Date inesistenti (es. `2026-02-30`) danno 400.
- `status` ∈ `pending | approved | rejected`; `modelId`, `nodes`, `edges` sono interi.
- Tutti i filtri sono opzionali e combinati in AND; parametri sconosciuti o valori non validi danno 400.

## Progettazione

### Casi d'uso

![Diagramma dei casi d'uso: utente autenticato e admin con le operazioni che possono eseguire](docs/diagrammi/Casi_d_uso_sistema.png)

Nel sistema ci sono due ruoli: `user` e `admin`. Il proprietario del modello non è un ruolo: è semplicemente l'utente che ha creato quel modello, e solo lui può approvare o rifiutare le richieste di cambio peso su quel modello. L'admin può fare le stesse cose di un utente e in più può ricaricare i token (`POST /admin/recharge`); paga gli stessi token e sulle richieste degli altri non può decidere.

| Operazione | Utente | Admin | Token addebitati |
|---|---|---|---|
| Creare un modello | sì | sì | sì |
| Eseguire un modello | sì | sì | sì |
| Simulare la variazione di un peso | sì | sì | no |
| Consultare le versioni dei pesi | sì | sì | no |
| Chiedere il cambio di peso di un arco | sì | sì | no |
| Consultare lo stato delle richieste | sì | sì | no |
| Approvare o rifiutare una richiesta | solo se proprietario del modello | solo se proprietario del modello | no |
| Ricaricare i token di un utente | no (403) | sì | no |

Con i token terminati ogni richiesta, di qualunque ruolo, riceve 401.

### Modello dei dati

![Modello dei dati: utenti, modelli, versioni dei pesi, archi e richieste di cambio peso con le relative relazioni](docs/diagrammi/Modello_dei_dati.png)

Una **versione dei pesi** è una fotografia completa del grafo: ogni approvazione crea la versione successiva copiando gli archi e
cambiando solo il peso richiesto. Le versioni precedenti restano intatte e consultabili.
I pesi di una richiesta *pending* non toccano il modello: l'esecuzione usa sempre la versione più recente.

### Diagrammi di sequenza

**Creazione di un modello con addebito dei token**

`POST /models`: crea un modello da un grafo e dai suoi pesi e addebita 0.20 token per nodo e 0.01 per arco. Richiede il JWT. Successo: 201. Errori: 400 (body non valido), 401 (JWT non valido, token terminati o insufficienti).

![Diagramma di sequenza della creazione di un modello con addebito dei token, transazione e rollback per saldo insufficiente](docs/diagrammi/Creazione_di_un_modello_con_addebito_dei_token.png)

**Esecuzione di un modello**

`POST /models/:id/execute`: calcola il percorso minimo tra `start` e `goal` sulla versione più recente dei pesi, con il costo del percorso e il tempo di esecuzione, e addebita lo stesso costo della creazione. Richiede il JWT. Successo: 200. Errori: 400 (body non valido o nodo sconosciuto), 401 (JWT non valido, token terminati o insufficienti), 404 (modello inesistente).

![Diagramma di sequenza dell'esecuzione di un modello: transazione, addebito, calcolo del percorso e gestione degli errori](docs/diagrammi/Esecuzione_di_un_modello.png)

**Approvazione di una richiesta di cambio peso**

`PATCH /weight-requests/:id/approve`: approva una richiesta *pending*, aggiorna il peso con la media esponenziale e crea una nuova versione dei pesi. Richiede il JWT e che l'utente sia il proprietario del modello. Successo: 200. Errori: 401, 403 (non proprietario), 404 (richiesta inesistente), 409 (richiesta già decisa o arco non più presente).

![Diagramma di sequenza dell'approvazione di una richiesta di cambio peso da parte dell'utente proprietario del modello, con la nuova versione dei pesi](docs/diagrammi/Approvazione_di_una_richiesta_di_cambio_peso.png)

**Simulazione della variazione di un peso**

`POST /models/:id/simulate`: fa variare il peso di un arco da un valore iniziale a uno finale con un dato passo e restituisce tutti i risultati e il migliore con la configurazione dei pesi. Non addebita token e non modifica il modello. Richiede il JWT. Successo: 200. Errori: 400 (range, passo o nodi non validi), 401, 404 (modello o arco inesistenti).

![Diagramma di sequenza della simulazione: nessun addebito, calcolo dei passi, percorso a ogni passo, scelta del risultato migliore e risposta](docs/diagrammi/Simulazione_del_modello.png)

**Creazione di una richiesta di cambio peso e rifiuto da parte del proprietario del modello**

`POST /models/:id/weight-requests`: propone un nuovo peso per un arco; la richiesta nasce *pending* (successo: 201; errori: 400, 401, 404 per modello o arco inesistenti). `PATCH /weight-requests/:id/reject`: il proprietario del modello rifiuta con una motivazione obbligatoria (successo: 200; errori: 400 se manca `reason`, 401, 403 se non è proprietario, 404, 409 se già decisa). Entrambe richiedono il JWT.

![Diagramma di sequenza della creazione di una richiesta di cambio peso in stato pending e del rifiuto con motivazione da parte del proprietario](docs/diagrammi/Creazione_e_rifiuto_di_una_richiesta_di_cambio_peso.png)

**Ricarica dei token di un utente**

`POST /admin/recharge`: l'admin somma un credito al saldo di un utente indicato per email. Richiede il JWT e il ruolo admin. Successo: 200. Errori: 400 (email o credito non validi), 401, 403 (ruolo non admin), 404 (utente inesistente).

![Diagramma di sequenza della ricarica dei token da parte dell'admin, con controllo del ruolo e ricerca dell'utente per email](docs/diagrammi/Ricarica_dei_token_di_un_utente.png)

**Versioni dei pesi di un modello**

`GET /models/:id/versions`: elenca le versioni dei pesi di un modello con gli archi, con filtri opzionali in AND su data di modifica, numero di nodi e numero di archi. Richiede il JWT. Successo: 200. Errori: 400 (id o filtri non validi), 401, 404 (modello inesistente).

![Diagramma di sequenza dell'elenco delle versioni dei pesi di un modello con i filtri opzionali](docs/diagrammi/Versioni_dei_pesi_di_un_modello.png)

**Stato delle richieste di cambio peso**

`GET /weight-requests`: elenca le richieste inviate dall'utente o fatte sui suoi modelli, dalla più recente, con filtri opzionali in AND su modello, data di invio e stato. Richiede il JWT. Successo: 200. Errori: 400 (filtri non validi), 401.

![Diagramma di sequenza della consultazione delle richieste di cambio peso con i filtri combinabili](docs/diagrammi/Stato_delle_richieste.png)

**Verifica del servizio**

`GET /health`: risponde 200 se il servizio è attivo. È l'unica rotta pubblica, senza JWT.

![Diagramma di sequenza della rotta di verifica del servizio](docs/diagrammi/Verifica_del_servizio.png)

### Pattern usati e motivazioni

La specifica non indica quali pattern usare, ma chiede di documentarli e di motivarli.

#### MVC con Service Layer

Il progetto è organizzato in strati: le rotte (`src/routes/`) inoltrano la richiesta al controller (`src/controllers/`), che legge i dati già validati, chiama un servizio (`src/services/`) e scrive la risposta JSON, che è la "view" dell'MVC (il client, per esempio Postman, non fa parte del back-end). Le regole di business (costi dei token, media esponenziale, versioni, simulazione) stanno nei servizi e si provano senza HTTP: per esempio `tests/alphaAndBlend.test.ts` verifica la media esponenziale chiamando direttamente `blendWeight`. In questo modo i controller restano sottili e le regole non dipendono da Express.

```ts
// src/controllers/ModelController.ts
  /** POST /models */
  static async create(req: Request, res: Response): Promise<void> {
    const { name, graph } = req.body as { name: string; graph: GraphInput };
    res.status(201).json(await ModelService.create(ModelController.userId(req), name, graph));
  }
```

#### DAO

Le query al database non stanno nei servizi ma nelle classi di `src/dao/` (`UserDao`, `ModelDao`, `WeightRequestDao`), che espongono metodi con nomi di dominio come `deductTokens`, `lockById` o `findLatestVersion`. Qui vivono anche le operazioni delicate: l'addebito dei token è una sola `UPDATE ... WHERE tokens >= :amount`, che impedisce a due richieste concorrenti di portare il saldo sotto zero, e il blocco `SELECT ... FOR UPDATE` serializza le approvazioni sullo stesso modello. Nei test i DAO sono sostituiti da mock, quindi non serve il database. Le transazioni le aprono i servizi e le passano ai DAO, e `WeightRequestService` modifica direttamente l'istanza `WeightChangeRequest` prima di farla salvare al DAO.

```ts
// src/dao/UserDao.ts
  static async deductTokens(userId: number, amount: number, tx?: Transaction): Promise<number | null> {
    const [rows] = await Database.getInstance().query(
      'UPDATE users SET tokens = tokens - :amount WHERE id = :id AND tokens >= :amount RETURNING tokens',
      { replacements: { amount: amount.toFixed(2), id: userId }, transaction: tx },
    );
    const updated = rows as { tokens: string }[];
    return updated.length === 0 ? null : Number(updated[0].tokens);
  }
```

#### Chain of Responsibility, nella variante a pipeline di Express

I controlli sulla richiesta sono middleware (`src/middleware/`) messi in catena: ognuno fa un solo controllo e passa al successivo con `next()`, oppure interrompe la catena con `next(err)`. `authenticate` verifica il JWT, `checkTokens` controlla che l'utente abbia ancora token, `requireRole` limita la rotta a un ruolo e `validateBody`, `validateParams` e `validateQuery` validano i dati. `authenticate` e `checkTokens` sono applicati una volta sola al router principale; ogni rotta aggiunge gli anelli che le servono, per esempio solo la ricarica usa `requireRole('admin')`. L'ordine conta: `checkTokens` viene dopo `authenticate` perché serve sapere chi è l'utente, e `requireRole` viene dopo `checkTokens`, quindi a token finiti anche l'admin riceve 401.

```ts
// src/routes/index.ts
apiRouter.use(authenticate, checkTokens);
apiRouter.use('/admin', adminRoutes);
```

```ts
// src/routes/adminRoutes.ts
adminRoutes.post('/recharge', requireRole('admin'), validateBody(rechargeSchema), asyncHandler(AdminController.recharge));
```

**Catena di middleware per rotta**

`express.json()` (lettura del body) è applicato a tutta l'applicazione. `authenticate` e `checkTokens` sono applicati a ogni rotta registrata in `apiRouter`; la tabella elenca la catena nell'ordine di esecuzione, prima del controller (sempre dietro `asyncHandler`).

| Rotta | Catena in ordine |
|---|---|
| `GET /health` | nessuna catena: è registrata in `app.ts` prima di `apiRouter` |
| `POST /admin/recharge` | `authenticate`, `checkTokens`, `requireRole('admin')`, `validateBody(rechargeSchema)` |
| `POST /models` | `authenticate`, `checkTokens`, `validateBody(createModelSchema)` |
| `POST /models/:id/execute` | `authenticate`, `checkTokens`, `validateParams(idParamSchema)`, `validateBody(executeModelSchema)` |
| `POST /models/:id/simulate` | `authenticate`, `checkTokens`, `validateParams(idParamSchema)`, `validateBody(simulationSchema)` |
| `GET /models/:id/versions` | `authenticate`, `checkTokens`, `validateParams(idParamSchema)`, `validateQuery(versionsQuerySchema)` |
| `POST /models/:id/weight-requests` | `authenticate`, `checkTokens`, `validateParams(idParamSchema)`, `validateBody(createWeightRequestSchema)` |
| `GET /weight-requests` | `authenticate`, `checkTokens`, `validateQuery(requestsQuerySchema)` |
| `PATCH /weight-requests/:id/approve` | `authenticate`, `checkTokens`, `validateParams(idParamSchema)` |
| `PATCH /weight-requests/:id/reject` | `authenticate`, `checkTokens`, `validateParams(idParamSchema)`, `validateBody(rejectWeightRequestSchema)` |
| rotta inesistente | `authenticate`, `checkTokens`, poi `notFound` (404) |

Solo `/admin/recharge` usa `requireRole`. Per approvare o rifiutare una richiesta non basta il ruolo: bisogna essere il proprietario di quel modello, e questo lo controlla il servizio. Dopo `apiRouter` ci sono `notFound` e `errorHandler`.

#### Factory (static factory)

`ErrorFactory` (`src/errors/ErrorFactory.ts`) crea gli errori applicativi con metodi statici (`unauthorized`, `forbidden`, `badRequest`, `notFound`, `conflict` e così via), ognuno dei quali restituisce un `AppError` con status, codice e messaggio. Serve a definire ogni errore in un solo punto: `checkTokens` e `TokenService.charge` producono lo stesso 401 `INSUFFICIENT_TOKENS`. Middleware e servizi sollevano l'errore, e l'`errorHandler` (`src/middleware/errorHandler.ts`) lo riconosce con `instanceof` e risponde con il suo status e il suo codice, come chiede la specifica, che vuole gli errori gestiti dagli strati middleware sollevando eccezioni.

```ts
// src/errors/ErrorFactory.ts
  /** 401: i token dell'utente sono terminati. */
  static insufficientTokens(message = 'Token terminati o insufficienti'): AppError {
    return new AppError(401, 'INSUFFICIENT_TOKENS', message);
  }
```

```ts
// src/middleware/errorHandler.ts
  const appError = err instanceof AppError ? err : fromBodyParser(err);
  if (appError) {
    res.status(appError.status).json({ error: { code: appError.code, message: appError.message } });
    return;
  }
```

#### Singleton

`Database` (`src/config/database.ts`) garantisce una sola istanza Sequelize per tutto il processo. Il costruttore è privato, quindi non si può scrivere `new Database()`: l'istanza si ottiene con `Database.getInstance()`, che la crea alla prima chiamata e la restituisce alle successive. Serve a condividere un solo pool di connessioni tra DAO e servizi, senza passare l'oggetto Sequelize come parametro; `tests/setup.test.ts` verifica che due chiamate restituiscano lo stesso oggetto.

```ts
// src/config/database.ts
  private constructor() {}

  /** Restituisce l'istanza Sequelize, creandola alla prima chiamata. */
  static getInstance(): Sequelize {
    if (!Database.instance) {
      Database.instance = new Sequelize(env.db.name, env.db.user, env.db.password, {
        host: env.db.host,
        port: env.db.port,
        dialect: 'postgres',
        logging: false,
      });
    }
    return Database.instance;
  }
```

Due cose non sono pattern ma aiutano. `asyncHandler` (`src/middleware/asyncHandler.ts`) è una piccola funzione che passa a `next()` gli errori dei gestori asincroni, così arrivano all'`errorHandler`. Le transazioni le aprono i servizi con `Database.getInstance().transaction(...)`, così le scritture vanno a buon fine tutte insieme oppure nessuna.

Gli errori si gestiscono solo nei middleware: controller e servizi non scrivono mai risposte di errore, lanciano un `AppError` e l'`errorHandler` lo trasforma in JSON `{ "error": { "code", "message" } }`. Gli errori imprevisti diventano un 500 generico.

## Decisioni di progetto

Dove la specifica lascia spazio ho deciso così:

- Se i token non bastano, la risposta è 401 `INSUFFICIENT_TOKENS`, come quando i token sono finiti. Il saldo si scala con un'unica `UPDATE ... WHERE tokens >= costo`, nella stessa transazione che crea il modello: se il credito non basta, non viene creato niente.
- Il costo (0.20 per nodo e 0.01 per arco) si calcola in centesimi, con numeri interi, per evitare gli errori dei numeri decimali.
- Solo chi ha creato il modello può approvare o rifiutare le richieste di cambio peso. L'admin no: anche lui riceve 403. Se la richiesta è già stata decisa, la risposta è 409.
- Il nuovo peso si calcola con `p = alpha * p_vecchio + (1 - alpha) * p_nuovo`, arrotondato a 4 decimali. `alpha` si legge dalla variabile `ALPHA` e deve essere maggiore di 0 e minore di 1; se non lo è, il sistema parte con 0.9.
- Ogni approvazione crea una nuova versione dei pesi, e quando si esegue un modello si usa sempre l'ultima.
- La simulazione non consuma token e non modifica il modello. Il risultato migliore è quello con il costo del percorso più basso; a parità vince il peso più piccolo.
- Quando l'admin ricarica un utente, l'importo viene sommato al saldo e non lo sostituisce.

## Errori

Formato: `{ "error": { "code": "...", "message": "..." } }`.

| Status | Codice | Quando |
|---|---|---|
| 400 | `BAD_REQUEST` | corpo, parametri o filtri non validi; JSON malformato; nodo sconosciuto; range di simulazione non ammissibile |
| 401 | `UNAUTHORIZED` | JWT assente, malformato, scaduto o con firma errata; utente inesistente |
| 401 | `INSUFFICIENT_TOKENS` | token terminati, o insufficienti a coprire il costo |
| 403 | `FORBIDDEN` | ruolo non autorizzato (non admin) o non proprietario del modello |
| 404 | `NOT_FOUND` | modello, arco, richiesta o utente inesistenti; rotta sconosciuta (con un JWT valido: senza JWT si ottiene 401) |
| 409 | `CONFLICT` | richiesta di cambio peso già approvata o rifiutata |
| 413 | `PAYLOAD_TOO_LARGE` | body della richiesta oltre il limite di 100 kb |
| 500 | `INTERNAL_ERROR` | errore inatteso (messaggio generico) |

## Dati iniziali (seed)

Il seed gira automaticamente all'avvio del container `app` e solo se il database è vuoto, quindi è sicuro riavviare.
Per azzerare e ripopolare:

```bash
docker compose exec app npm run seed -- --force
```

| Id | Email | Ruolo | Token iniziali | Note |
|---|---|---|---|---|
| 1 | `chiara.ferri@example.com` | admin | 1000 | amministratore; anche l'admin è soggetto al controllo dei token |
| 2 | `luca.bianchi@example.com` | user | 100 | proprietario del modello 1 (Rete stradale Ancona) |
| 3 | `sofia.romano@example.com` | user | 100 | proprietario del modello 2 (Rete ciclabile Jesi) |
| 4 | `andrea.conti@example.com` | user | 50 | utente generico |
| 5 | `elena.greco@example.com` | user | 0 | senza token: per provare il 401 a token finiti |

| Modello | Proprietario | Nodi | Archi | Versioni |
|---|---|---|---|---|
| 1 - Rete stradale Ancona | Luca Bianchi | 12 | 18 | 2 |
| 2 - Rete ciclabile Jesi | Sofia Romano | 10 | 16 | 2 |

I nodi sono luoghi delle due città (per esempio *Stazione*, *Porto*, *Duomo*, *Passetto* ad Ancona; *Porta Valle*, *Teatro Pergolesi* a Jesi) e i pesi sono minuti di percorrenza di fantasia, scelti per avere percorsi alternativi da confrontare.

Richieste iniziali: 2 approvate (che hanno generato le versioni 2), 1 *pending* (modello 1, arco da Piazza Cavour a Piazza Roma) e 1 rifiutata con motivazione.

## Avvio con docker-compose

Prerequisiti: Docker con Compose v2.

1. **Configurazione.** Copia il file di esempio e imposta almeno `DB_PASSWORD` (il file `.env` non è tracciato da git):

   ```bash
   cp .env.example .env
   ```

   | Variabile | Significato |
   |---|---|
   | `PORT` | porta esposta dall'applicazione (default 3000) |
   | `DB_NAME`, `DB_USER`, `DB_PASSWORD` | credenziali del database; usate sia da Postgres sia dall'app (`DB_HOST` e `DB_PORT` sono impostati da compose) |
   | `JWT_PRIVATE_KEY` | chiave privata RS256 in formato PEM su una riga, con le newline scritte come `\n` |
   | `ALPHA` | coefficiente della media esponenziale, tra 0 e 1 (esclusi); se errato si usa 0.9 |

2. **Chiave RS256.** Genera una chiave privata e incolla in `.env` la riga `JWT_PRIVATE_KEY="..."` (su una sola riga, con le newline scritte come `\n`).
   La chiave non va mai committata. Con `openssl`:

   ```bash
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
   printf 'JWT_PRIVATE_KEY="%s"\n' "$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private.pem)"
   ```

   Il secondo comando stampa la riga da incollare in `.env`; poi cancella `private.pem`. In alternativa, senza `openssl`, lo script del progetto stampa la stessa riga:

   ```bash
   docker compose run --rm --no-deps app npm run keys
   ```

   Nel container i file `keys/` spariscono insieme al container (`--rm`): conta solo la riga stampata. Con Node installato in locale: `npm install && npm run keys` (qui `keys/` è una cartella ignorata da git).

3. **Avvio.** Costruisce le immagini, avvia Postgres e l'applicazione ed esegue il seed:

   ```bash
   docker compose up --build
   ```

   L'API risponde su `http://localhost:3000` (`GET /health`). Il database non è esposto sull'host: resta nella rete interna di compose.

4. **Token per provare le rotte.** I JWT generati con `npm run token` durano 1 giorno: vanno rigenerati prima di provare la collection Postman se sono scaduti. Per ottenere un token per ogni utente del seed:

   ```bash
   docker compose exec app npm run token -- all
   ```

   Per un solo utente: `docker compose exec app npm run token -- <userId> <user|admin>`.

Esempio:

```bash
curl -s -X POST http://localhost:3000/models/1/execute \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"start":"Stazione","goal":"Collemarino"}'
```

Per fermare tutto: `docker compose down` (aggiungi `-v` per cancellare anche i dati del database).

## Test

![Risultati test](docs/test_suites.png)

Sono presenti **69 test Jest** in 18 suite (`tests/`). Jest sostituisce i DAO e la transazione con mock, quindi i test non richiedono il database; le rotte si provano sull'app Express con `supertest` (JWT reali firmati con una chiave di test). Le query SQL reali si verificano con Postman sul database seminato (sezione "Test con Postman").

| Suite | Cosa verifica |
|---|---|
| `setup`, `validateConfig` | `GET /health`, Singleton del database, configurazione valida e chiave JWT vuota rifiutata all'avvio |
| `authenticate`, `roleAndTokens`, `tokenCharge` | JWT valido, mancante, firmato con un'altra chiave, scaduto, HS256; ruoli; token finiti: 401; addebito dei token, con la lettura del saldo nella stessa transazione |
| `adminRoutes` | ricarica: 401, 403, 400, 404, 200 |
| `modelValidation` | calcolo del costo, validazione del grafo e del nome |
| `modelRoutes`, `executeRollback` | creazione con e senza credito, esecuzione, nodo sconosciuto, logica del rollback dell'addebito |
| `alphaAndBlend`, `alphaEnv` | alpha valido o errato, media esponenziale, alpha letto dall'ambiente all'avvio |
| `weightRequestRoutes`, `weightRequestAtomicity` | creazione, validazione del peso, approvazione, rifiuto, 403 e 409, approvazione doppia, logica del rollback |
| `queryRoutes`, `queryFilters` | filtri di richieste e versioni, data non valida, visibilità delle richieste |
| `simulation` | passi da 1 a 2 con passo 0.05, validazione dei range, best result e parità di costo, nessun addebito di token |
| `errorHandler` | traduzione degli errori in risposte HTTP, errori inattesi senza dettagli |
| `seed` | il seed gira in un'unica transazione e, con la transazione simulata, annulla tutto se un inserimento fallisce |

```bash
docker compose exec app npm test     # nel container
npm test                             # in locale (dopo npm install)
npx tsc --noEmit                     # controllo dei tipi
```

## Test con Postman

![Test Postman](docs/Postman_test.png)

Nella cartella `postman/` ci sono:

- `grafo-pa.postman_collection.json`: 56 richieste in 5 cartelle (autenticazione e ruoli, admin, modelli, versioni e simulazione, richieste di cambio peso), con script di test (117 asserzioni) che verificano status e contenuto delle risposte, compresi i casi di errore;
- `grafo-pa.postman_environment.json`: variabile `baseUrl` e i token `adminToken`, `ownerAnconaToken`, `ownerJesiToken`, `userToken`, `noTokensToken`.

Procedura:

1. Importa in Postman la collection e il file di ambiente e seleziona l'ambiente.
2. Parti da un database appena seminato: `docker compose exec app npm run seed -- --force`.
3. Genera i token con `docker compose exec app npm run token -- all` (stampa righe `nome=token`) e incollali nelle variabili dell'ambiente. I token durano 1 giorno: rigenerali prima di ogni sessione di prova.
4. Esegui la collection con il *Collection Runner*, **in ordine**: le richieste sono pensate per essere eseguite di seguito e si passano id creati a runtime (modello e richieste). Dopo una esecuzione ripeti il seed prima di rilanciarla.

Da riga di comando è possibile eseguire la stessa collection con `newman` (non incluso nelle dipendenze).

## Struttura del repository

```
src/
  config/        variabili d'ambiente, controllo di alpha, connessione al database (Singleton)
  models/        modelli Sequelize e relazioni
  dao/           accesso ai dati
  services/      logica di business (token, esecuzione, richieste, versioni, simulazione, JWT)
  controllers/   lettura della richiesta e risposta HTTP
  routes/        definizione degli endpoint
  middleware/    JWT, token residui, ruoli, validazione, gestione errori
  validators/    schemi zod
  errors/        AppError e ErrorFactory
  seeders/       script di seed
  scripts/       generazione chiavi e token
tests/           test Jest
postman/         collection e ambiente
docs/            specifica del progetto, diagrammi e immagini dei test
Dockerfile, docker-compose.yml, jest.config.js, tsconfig.json
```
