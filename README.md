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

Il sistema è un back-end REST che permette di **creare, eseguire e valutare modelli di ottimizzazione su grafo**
(percorso di costo minimo, calcolato con [`node-dijkstra`](https://www.npmjs.com/package/node-dijkstra)).
Simula il *crowd-sourcing*: ogni utente autenticato può proporre un nuovo valore per il peso di un arco
(ad esempio i minuti necessari a percorrere un tratto di strada); il proprietario del modello decide se accettarlo.
Quando la proposta è approvata il peso viene aggiornato con una media esponenziale e nasce una nuova **versione dei pesi**.

Funzionalità:

- creazione di un modello da un grafo (nel formato di `node-dijkstra`) con validazione e addebito di token;
- esecuzione di un modello (percorso, costo del percorso, tempo di esecuzione) con addebito di token;
- richieste di cambio peso con stati *pending*, poi *approved* o *rejected* (con motivazione);
- consultazione dello stato delle richieste e delle versioni dei pesi, con filtri;
- simulazione della variazione del peso di un arco, con risultato migliore e relativa configurazione dei pesi;
- gestione dei token per utente e rotta admin di ricarica; tutte le rotte sono protette da JWT RS256.

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
