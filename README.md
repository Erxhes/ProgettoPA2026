# Backend per modelli di ottimizzazione su grafo

Progetto individuale per l'esame di Programmazione Avanzata (A.A. 2025/2026, UNIVPM).

## Obiettivo

Back-end REST in TypeScript per creare, eseguire e valutare modelli di ottimizzazione su grafo.
Gli utenti autenticati con JWT possono aggiornare i pesi degli archi (per esempio i minuti per percorrere un tratto di strada), simulando il crowd-sourcing.

## Funzionalità

- Applicazione Express con la rotta `GET /health`
- Connessione a Postgres con Sequelize (Singleton)
- Configurazione da variabili d'ambiente, con controllo all'avvio di porte e chiave JWT RS256
- Docker e docker-compose (app + Postgres)
- Modelli Sequelize per utenti, modelli di grafo, versioni dei pesi, archi e richieste di cambio peso
- Seed con utenti, token iniziali e modelli di esempio
- Test con Jest

## Stack

Node.js 24, TypeScript (strict), Express, Sequelize, Postgres, JWT RS256, Jest, Docker.

## Come avviare il progetto

1. Copia `.env.example` in `.env` e compila i valori (credenziali del database e chiave privata RS256).
2. Avvia tutto con Docker:

```bash
docker compose up --build
```

3. Verifica che il servizio risponda:

```bash
curl http://localhost:3000/health
```

La risposta attesa è `{"status":"ok"}`.

## Dati di demo

All'avvio del container l'app esegue il seed, che crea le tabelle e poi inserisce i dati di esempio in un'unica transazione. Se il database contiene già degli utenti, il seed non fa nulla, quindi il riavvio non duplica i dati.

- 5 utenti: un admin con 1000 token, due utenti con 100 token, uno con 50 e uno con 0
- 2 modelli: la rete stradale di Ancona (12 nodi, 18 archi) e la rete ciclabile di Jesi (10 nodi, 16 archi), ciascuno con 2 versioni dei pesi
- 4 richieste di cambio peso: 2 approvate, 1 in attesa e 1 rifiutata con motivazione

Per azzerare il database e rifare il seed:

```bash
docker compose exec app npm run seed -- --force
```

## Test

```bash
npm test
```

oppure nel container:

```bash
docker compose exec app npm test
```
