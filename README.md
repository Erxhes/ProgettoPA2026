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

## Test

```bash
npm test
```

oppure nel container:

```bash
docker compose exec app npm test
```
