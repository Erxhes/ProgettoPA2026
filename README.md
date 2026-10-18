# Backend per modelli di ottimizzazione su grafo

Progetto individuale per l'esame di Programmazione Avanzata (A.A. 2025/2026, UNIVPM).

## Indice

1. [Obiettivo](#obiettivo)
2. [Stack](#stack)
3. [Rotte](#rotte)
4. [Progettazione](#progettazione)
5. [Decisioni di progetto](#decisioni-di-progetto)
6. [Errori](#errori)
7. [Dati di demo (seed)](#dati-di-demo-seed)
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

