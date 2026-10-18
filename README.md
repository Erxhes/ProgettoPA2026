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

