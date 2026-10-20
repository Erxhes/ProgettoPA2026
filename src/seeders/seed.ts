import { Transaction } from 'sequelize';
import { Database } from '../config/database';
import { Edge, GraphModel, ModelVersion, User, WeightChangeRequest } from '../models';
import { AuthService } from '../services/AuthService';

/** Arco dei grafi iniziali: [da, a, peso]. */
type EdgeDef = [string, string, number];

/** Rete stradale di Ancona (minuti di percorrenza): 12 nodi, 18 archi. */
const ANCONA: EdgeDef[] = [
  ['Stazione', 'Porto', 4], ['Stazione', 'Piazza Cavour', 2], ['Porto', 'Piazza Cavour', 1],
  ['Porto', 'Piazza Roma', 5], ['Piazza Cavour', 'Piazza Roma', 8], ['Piazza Cavour', 'Archi', 10],
  ['Piazza Roma', 'Archi', 4], ['Piazza Roma', 'Duomo', 2], ['Archi', 'Duomo', 3],
  ['Archi', 'Posatora', 7], ['Duomo', 'Passetto', 6], ['Posatora', 'Passetto', 1],
  ['Posatora', 'Torrette', 9], ['Passetto', 'Montedago', 4], ['Torrette', 'Montedago', 2],
  ['Torrette', 'Tavernelle', 6], ['Montedago', 'Collemarino', 3], ['Tavernelle', 'Collemarino', 5],
];

/** Rete ciclabile di Jesi (minuti di percorrenza): 10 nodi, 16 archi. */
const JESI: EdgeDef[] = [
  ['Stazione', 'Porta Valle', 3], ['Stazione', 'Viale Don Minzoni', 5],
  ['Porta Valle', 'Piazza della Repubblica', 2], ['Porta Valle', 'Teatro Pergolesi', 6],
  ['Viale Don Minzoni', 'Teatro Pergolesi', 4], ['Viale Don Minzoni', 'Ospedale', 7],
  ['Piazza della Repubblica', 'Teatro Pergolesi', 1], ['Piazza della Repubblica', 'Palazzo della Signoria', 3],
  ['Teatro Pergolesi', 'Palazzo della Signoria', 1], ['Teatro Pergolesi', 'Campo Sportivo', 5],
  ['Ospedale', 'Palazzo della Signoria', 3], ['Ospedale', 'Campo Sportivo', 2],
  ['Palazzo della Signoria', 'Cimitero', 4], ['Campo Sportivo', 'Cimitero', 3],
  ['Campo Sportivo', 'Zona Industriale', 6], ['Cimitero', 'Zona Industriale', 2],
];

/** Numero di nodi distinti toccati dagli archi. */
function countNodes(edges: EdgeDef[]): number {
  return new Set(edges.flatMap(([from, to]) => [from, to])).size;
}

/** Crea una versione con i suoi archi, nella transazione data. */
async function createVersion(modelId: number, versionNumber: number, edges: EdgeDef[], tx: Transaction): Promise<ModelVersion> {
  const version = await ModelVersion.create(
    { modelId, versionNumber, nodeCount: countNodes(edges), edgeCount: edges.length },
    { transaction: tx },
  );
  await Edge.bulkCreate(
    edges.map(([fromNode, toNode, weight]) => ({ versionId: version.id, fromNode, toNode, weight })),
    { transaction: tx },
  );
  return version;
}

/** Copia degli archi con un arco aggiornato con la media esponenziale (alpha = 0.9). */
function withUpdatedWeight(edges: EdgeDef[], from: string, to: string, newWeight: number, alpha = 0.9): EdgeDef[] {
  return edges.map(([f, t, w]): EdgeDef => (f === from && t === to ? [f, t, alpha * w + (1 - alpha) * newWeight] : [f, t, w]));
}

/**
 * Popola il database con i dati iniziali. Con `force` azzera prima le tabelle;
 * senza `force` non fa nulla se esistono già degli utenti (idempotente).
 */
export async function runSeed(force: boolean): Promise<void> {
  const sequelize = Database.getInstance();
  await sequelize.sync({ force });
  if (!force && (await User.count()) > 0) {
    console.log('Seed già eseguito, nessuna modifica');
    return;
  }

  // Password di prova degli utenti (scritte anche nel README), cifrate prima di aprire la transazione
  const datiUtenti = [
    { email: 'chiara.ferri@example.com', username: 'chiara', password: 'Chiara2026!', role: 'admin', tokens: 1000 },
    { email: 'luca.bianchi@example.com', username: 'luca', password: 'Luca2026!', role: 'user', tokens: 100 },
    { email: 'sofia.romano@example.com', username: 'sofia', password: 'Sofia2026!', role: 'user', tokens: 100 },
    { email: 'andrea.conti@example.com', username: 'andrea', password: 'Andrea2026!', role: 'user', tokens: 50 },
    { email: 'elena.greco@example.com', username: 'elena', password: 'Elena2026!', role: 'user', tokens: 0 },
  ] as const;
  const hashes = await Promise.all(datiUtenti.map((u) => AuthService.hashPassword(u.password)));

  // Un'unica transazione: se un inserimento fallisce non resta un seed a metà
  const adminId = await sequelize.transaction(async (tx) => {
    const utenti: User[] = [];
    for (const [i, u] of datiUtenti.entries()) {
      const { password: _password, ...campi } = u;
      utenti.push(await User.create({ ...campi, passwordHash: hashes[i] }, { transaction: tx }));
    }
    const [admin, luca, sofia, andrea] = utenti;

    const ancona = await GraphModel.create({ name: 'Rete stradale Ancona', ownerId: luca.id }, { transaction: tx });
    await createVersion(ancona.id, 1, ANCONA, tx);
    const anconaV2 = await createVersion(ancona.id, 2, withUpdatedWeight(ANCONA, 'Piazza Roma', 'Duomo', 3), tx);

    const jesi = await GraphModel.create({ name: 'Rete ciclabile Jesi', ownerId: sofia.id }, { transaction: tx });
    await createVersion(jesi.id, 1, JESI, tx);
    const jesiV2 = await createVersion(jesi.id, 2, withUpdatedWeight(JESI, 'Teatro Pergolesi', 'Palazzo della Signoria', 3), tx);

    const now = new Date();
    await WeightChangeRequest.bulkCreate([
      { modelId: ancona.id, requesterId: andrea.id, fromNode: 'Piazza Roma', toNode: 'Duomo', newWeight: 3, status: 'approved', resultingVersionId: anconaV2.id, decidedAt: now },
      { modelId: jesi.id, requesterId: luca.id, fromNode: 'Teatro Pergolesi', toNode: 'Palazzo della Signoria', newWeight: 3, status: 'approved', resultingVersionId: jesiV2.id, decidedAt: now },
      { modelId: ancona.id, requesterId: andrea.id, fromNode: 'Piazza Cavour', toNode: 'Piazza Roma', newWeight: 5, status: 'pending' },
      { modelId: jesi.id, requesterId: andrea.id, fromNode: 'Porta Valle', toNode: 'Teatro Pergolesi', newWeight: 1, status: 'rejected', rejectionReason: 'Il tratto è in salita: un minuto non è realistico, nemmeno in bicicletta', decidedAt: now },
    ], { transaction: tx });

    return admin.id;
  });
  console.log(`Seed completato (admin id=${adminId})`);
}

if (require.main === module) {
  runSeed(process.argv.includes('--force'))
    .then(() => Database.getInstance().close())
    .catch((err: unknown) => {
      console.error('Seed fallito:', err);
      process.exit(1);
    });
}
