import { Transaction } from 'sequelize';
import { Database } from '../config/database';
import { Edge, GraphModel, ModelVersion, User, WeightChangeRequest } from '../models';
import { AuthService } from '../services/AuthService';

/** Arco dei grafi iniziali: [da, a, peso]. */
type EdgeDef = [string, string, number];

/** Luoghi della rete stradale di Ancona (le sigle servono solo a scrivere gli archi in modo compatto). */
const ANCONA_NODI: Record<string, string> = {
  A: 'Stazione', B: 'Porto', C: 'Piazza Cavour', D: 'Piazza Roma', E: 'Archi', F: 'Duomo',
  G: 'Posatora', H: 'Passetto', I: 'Torrette', J: 'Montedago', K: 'Tavernelle', L: 'Collemarino',
};

/** Luoghi della rete ciclabile di Jesi. */
const JESI_NODI: Record<string, string> = {
  N1: 'Stazione', N2: 'Porta Valle', N3: 'Viale Don Minzoni', N4: 'Piazza della Repubblica',
  N5: 'Teatro Pergolesi', N6: 'Ospedale', N7: 'Palazzo della Signoria', N8: 'Campo Sportivo',
  N9: 'Cimitero', N10: 'Zona Industriale',
};

/** Sostituisce le sigle degli archi con i nomi dei luoghi. */
function conNomi(edges: EdgeDef[], nodi: Record<string, string>): EdgeDef[] {
  return edges.map(([da, a, peso]): EdgeDef => [nodi[da], nodi[a], peso]);
}

/** Rete stradale (minuti di percorrenza): 12 nodi, 18 archi. */
const ANCONA: EdgeDef[] = conNomi(
  [
    ['A', 'B', 4], ['A', 'C', 2], ['B', 'C', 1], ['B', 'D', 5], ['C', 'D', 8], ['C', 'E', 10],
    ['D', 'E', 4], ['D', 'F', 2], ['E', 'F', 3], ['E', 'G', 7], ['F', 'H', 6], ['G', 'H', 1],
    ['G', 'I', 9], ['H', 'J', 4], ['I', 'J', 2], ['I', 'K', 6], ['J', 'L', 3], ['K', 'L', 5],
  ],
  ANCONA_NODI,
);

/** Rete ciclabile (minuti di percorrenza): 10 nodi, 16 archi. */
const JESI: EdgeDef[] = conNomi(
  [
    ['N1', 'N2', 3], ['N1', 'N3', 5], ['N2', 'N4', 2], ['N2', 'N5', 6], ['N3', 'N5', 4], ['N3', 'N6', 7],
    ['N4', 'N5', 1], ['N4', 'N7', 3], ['N5', 'N7', 1], ['N5', 'N8', 5], ['N6', 'N7', 3], ['N6', 'N8', 2],
    ['N7', 'N9', 4], ['N8', 'N9', 3], ['N8', 'N10', 6], ['N9', 'N10', 2],
  ],
  JESI_NODI,
);

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
  const [hashChiara, hashLuca, hashSofia, hashAndrea, hashElena] = await Promise.all(
    ['Chiara2026!', 'Luca2026!', 'Sofia2026!', 'Andrea2026!', 'Elena2026!'].map((p) => AuthService.hashPassword(p)),
  );

  // Un'unica transazione: se un inserimento fallisce non resta un seed a metà (che il controllo
  // sugli utenti considererebbe già eseguito).
  const adminId = await sequelize.transaction(async (tx) => {
    const admin = await User.create(
      { email: 'chiara.ferri@example.com', username: 'chiara', passwordHash: hashChiara, role: 'admin', tokens: 1000 },
      { transaction: tx },
    );
    const luca = await User.create(
      { email: 'luca.bianchi@example.com', username: 'luca', passwordHash: hashLuca, role: 'user', tokens: 100 },
      { transaction: tx },
    );
    const sofia = await User.create(
      { email: 'sofia.romano@example.com', username: 'sofia', passwordHash: hashSofia, role: 'user', tokens: 100 },
      { transaction: tx },
    );
    const andrea = await User.create(
      { email: 'andrea.conti@example.com', username: 'andrea', passwordHash: hashAndrea, role: 'user', tokens: 50 },
      { transaction: tx },
    );
    await User.create(
      { email: 'elena.greco@example.com', username: 'elena', passwordHash: hashElena, role: 'user', tokens: 0 },
      { transaction: tx },
    );

    const ancona = await GraphModel.create({ name: 'Rete stradale Ancona', ownerId: luca.id }, { transaction: tx });
    await createVersion(ancona.id, 1, ANCONA, tx);
    const anconaV2 = await createVersion(ancona.id, 2, withUpdatedWeight(ANCONA, ANCONA_NODI.D, ANCONA_NODI.F, 3), tx);

    const jesi = await GraphModel.create({ name: 'Rete ciclabile Jesi', ownerId: sofia.id }, { transaction: tx });
    await createVersion(jesi.id, 1, JESI, tx);
    const jesiV2 = await createVersion(jesi.id, 2, withUpdatedWeight(JESI, JESI_NODI.N5, JESI_NODI.N7, 3), tx);

    const now = new Date();
    await WeightChangeRequest.bulkCreate([
      { modelId: ancona.id, requesterId: andrea.id, fromNode: ANCONA_NODI.D, toNode: ANCONA_NODI.F, newWeight: 3, status: 'approved', resultingVersionId: anconaV2.id, decidedAt: now },
      { modelId: jesi.id, requesterId: luca.id, fromNode: JESI_NODI.N5, toNode: JESI_NODI.N7, newWeight: 3, status: 'approved', resultingVersionId: jesiV2.id, decidedAt: now },
      { modelId: ancona.id, requesterId: andrea.id, fromNode: ANCONA_NODI.C, toNode: ANCONA_NODI.D, newWeight: 5, status: 'pending' },
      { modelId: jesi.id, requesterId: andrea.id, fromNode: JESI_NODI.N2, toNode: JESI_NODI.N5, newWeight: 1, status: 'rejected', rejectionReason: 'Il tratto è in salita: un minuto non è realistico, nemmeno in bicicletta', decidedAt: now },
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
