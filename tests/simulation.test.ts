import request from 'supertest';
import { createApp } from '../src/app';
import { ModelDao } from '../src/dao/ModelDao';
import { UserDao } from '../src/dao/UserDao';
import { Edge, GraphModel, ModelVersion, User } from '../src/models';
import { JwtService } from '../src/services/JwtService';
import { SimulationService, weightSteps } from '../src/services/SimulationService';
import { simulationSchema } from '../src/validators/simulationSchemas';

jest.mock('../src/dao/UserDao');
jest.mock('../src/dao/ModelDao');

const users = jest.mocked(UserDao);
const models = jest.mocked(ModelDao);

const app = createApp();
const auth = `Bearer ${JwtService.sign({ userId: 4, role: 'user' })}`;

/**
 * Grafo di test: A->B (simulato), A->C 2, C->B 2, B->D 1, E isolato da A.
 * Da A a D: via A->B costa w + 1; via C costa 5. Oltre w = 4 conviene passare da C.
 */
function version(): ModelVersion & { edges: Edge[] } {
  const edges = [
    { fromNode: 'A', toNode: 'B', weight: '3.0000' },
    { fromNode: 'A', toNode: 'C', weight: '2.0000' },
    { fromNode: 'C', toNode: 'B', weight: '2.0000' },
    { fromNode: 'B', toNode: 'D', weight: '1.0000' },
    { fromNode: 'D', toNode: 'E', weight: '1.0000' },
  ];
  return { versionNumber: 2, nodeCount: 5, edgeCount: 5, edges } as unknown as ModelVersion & { edges: Edge[] };
}

const valid = {
  start: 'A',
  goal: 'D',
  edge: { from: 'A', to: 'B' },
  initialWeight: 1,
  finalWeight: 6,
  step: 1,
};

describe('weightSteps', () => {
  it('da 1 a 2 con passo 0.05 dà 21 valori, ultimo 2', () => {
    const steps = weightSteps(1, 2, 0.05);
    expect(steps).toHaveLength(21);
    expect(steps[0]).toBe(1);
    expect(steps[1]).toBe(1.05);
    expect(steps[20]).toBe(2);
  });

  it('non accumula errori di virgola mobile', () => {
    expect(weightSteps(0.1, 0.3, 0.1)).toEqual([0.1, 0.2, 0.3]);
  });

  it('un solo valore se iniziale = finale', () => {
    expect(weightSteps(1, 1, 0.5)).toEqual([1]);
  });

  it('il passo che non divide il range lascia fuori il peso finale', () => {
    expect(weightSteps(1, 2, 0.3)).toEqual([1, 1.3, 1.6, 1.9]);
  });
});

describe('simulationSchema', () => {
  it('accetta una richiesta valida', () => {
    expect(simulationSchema.safeParse(valid).success).toBe(true);
    expect(simulationSchema.safeParse({ ...valid, initialWeight: 1, finalWeight: 2, step: 0.05 }).success).toBe(true);
  });

  it.each([
    ['iniziale > finale', { initialWeight: 5, finalWeight: 2 }],
    ['passo zero', { step: 0 }],
    ['passo negativo', { step: -1 }],
    ['passo maggiore del range', { step: 10 }],
    ['peso iniziale zero', { initialWeight: 0 }],
    ['peso iniziale negativo', { initialWeight: -1 }],
    ['peso finale oltre il massimo', { finalWeight: 2_000_000, step: 1_000_000 }],
    ['più di 4 decimali', { step: 0.00001 }],
    ['più di 1000 passi', { initialWeight: 1, finalWeight: 1002, step: 1 }],
    ['peso non numerico', { initialWeight: 'x' }],
  ])('rifiuta: %s', (_label, override) => {
    expect(simulationSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('con passo zero segnala un solo errore (nessun falso "troppi passi")', () => {
    const result = simulationSchema.safeParse({ ...valid, step: 0 });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
  });

  it('rifiuta campi mancanti', () => {
    const { edge: _edge, ...withoutEdge } = valid;
    expect(simulationSchema.safeParse(withoutEdge).success).toBe(false);
    expect(simulationSchema.safeParse({}).success).toBe(false);
  });

  it('il peso deve essere minore di 1000000, come nella creazione del modello', () => {
    const at = (initialWeight: number, finalWeight: number) =>
      simulationSchema.safeParse({ ...valid, initialWeight, finalWeight, step: 1 }).success;
    expect(at(999999.9999, 999999.9999)).toBe(true);
    expect(at(1000000, 1000000)).toBe(false);
    expect(at(999999, 1000000)).toBe(false);
    expect(at(1000000, 1000001)).toBe(false);
  });

  it('ammette esattamente 1000 passi', () => {
    expect(simulationSchema.safeParse({ ...valid, initialWeight: 1, finalWeight: 1000, step: 1 }).success).toBe(true);
  });
});

describe('SimulationService.simulate', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    models.findById.mockResolvedValue({ id: 1 } as GraphModel);
    models.findLatestVersion.mockResolvedValue(version());
  });

  it('il percorso cambia oltre la soglia e il best è il costo minore', async () => {
    const res = await SimulationService.simulate(1, valid);
    expect(res.count).toBe(6);
    expect(res.results.map((r) => r.cost)).toEqual([2, 3, 4, 5, 5, 5]);
    expect(res.results[0].path).toEqual(['A', 'B', 'D']);
    expect(res.results[5].path).toEqual(['A', 'C', 'B', 'D']);
    expect(res.versionNumber).toBe(2);
  });

  it('il best contiene la configurazione completa dei pesi con l\'arco al peso migliore', async () => {
    const res = await SimulationService.simulate(1, valid);
    expect(res.best).toMatchObject({ weight: 1, cost: 2, path: ['A', 'B', 'D'] });
    expect(res.best?.weights).toHaveLength(5);
    expect(res.best?.weights).toContainEqual({ from: 'A', to: 'B', weight: 1 });
    expect(res.best?.weights).toContainEqual({ from: 'A', to: 'C', weight: 2 });
  });

  it('non scrive nulla: nessun DAO di scrittura chiamato e i dati letti restano uguali', async () => {
    const v = version();
    const before = JSON.stringify(v);
    models.findLatestVersion.mockResolvedValue(v);
    await SimulationService.simulate(1, valid);
    expect(JSON.stringify(v)).toBe(before);
    expect(models.addVersion).not.toHaveBeenCalled();
    expect(models.createWithFirstVersion).not.toHaveBeenCalled();
    expect(users.deductTokens).not.toHaveBeenCalled();
    expect(users.addTokens).not.toHaveBeenCalled();
  });

  it('a parità di costo vince il peso più piccolo', async () => {
    // Da 4 a 6 il costo è sempre 5 (si passa da C): best = peso 4.
    const res = await SimulationService.simulate(1, { ...valid, initialWeight: 4, finalWeight: 6 });
    expect(res.results.map((r) => r.cost)).toEqual([5, 5, 5]);
    expect(res.best?.weight).toBe(4);
  });

  it('goal irraggiungibile: path/cost null e best null', async () => {
    const res = await SimulationService.simulate(1, { ...valid, start: 'E', goal: 'A' });
    expect(res.results.every((r) => r.path === null && r.cost === null)).toBe(true);
    expect(res.best).toBeNull();
  });

  it('start uguale a goal: percorso [start] a costo 0 a ogni passo, best = primo passo', async () => {
    const res = await SimulationService.simulate(1, { ...valid, start: 'A', goal: 'A' });
    expect(res.results).toHaveLength(6);
    expect(res.results.every((r) => r.cost === 0 && r.path?.length === 1 && r.path[0] === 'A')).toBe(true);
    expect(res.best).toMatchObject({ weight: 1, cost: 0, path: ['A'] });
    expect(res.best?.weights).toHaveLength(5);
    expect(res.best?.weights).toContainEqual({ from: 'A', to: 'B', weight: 1 });
  });

  it('404 per modello o arco inesistenti, 400 per nodo sconosciuto', async () => {
    await expect(SimulationService.simulate(1, { ...valid, edge: { from: 'A', to: 'D' } })).rejects.toMatchObject({ status: 404 });
    await expect(SimulationService.simulate(1, { ...valid, goal: 'Z' })).rejects.toMatchObject({ status: 400 });
    models.findById.mockResolvedValue(null);
    await expect(SimulationService.simulate(9, valid)).rejects.toMatchObject({ status: 404 });
  });
});

describe('POST /models/:id/simulate', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    users.findById.mockResolvedValue({ tokens: '50.00' } as User);
    models.findById.mockResolvedValue({ id: 1 } as GraphModel);
    models.findLatestVersion.mockResolvedValue(version());
  });

  const post = (body: object, id = '1') =>
    request(app).post(`/models/${id}/simulate`).set('Authorization', auth).send(body);

  it('401 senza JWT', async () => {
    await request(app).post('/models/1/simulate').send(valid).expect(401);
  });

  it('200 con tutti i risultati e il best, senza addebitare token', async () => {
    const res = await post(valid).expect(200);
    expect(res.body.count).toBe(6);
    expect(res.body.best).toMatchObject({ weight: 1, cost: 2 });
    expect(typeof res.body.executionTimeMs).toBe('number');
    expect(users.deductTokens).not.toHaveBeenCalled();
  });

  it('401 con un utente a 0 token', async () => {
    users.findById.mockResolvedValue({ tokens: '0.00' } as User);
    await post(valid).expect(401);
    expect(models.findLatestVersion).not.toHaveBeenCalled();
  });

  it('400 per range non ammissibile', async () => {
    await post({ ...valid, initialWeight: 5, finalWeight: 2 }).expect(400);
    await post({ ...valid, step: 0 }).expect(400);
  });

  it('400 per peso finale pari a 1000000, 200 per 999999.9999', async () => {
    await post({ ...valid, initialWeight: 1000000, finalWeight: 1000000, step: 1 }).expect(400);
    await post({ ...valid, initialWeight: 999999.9999, finalWeight: 999999.9999, step: 1 }).expect(200);
  });

  it('400 per nodo sconosciuto, 404 per arco o modello inesistenti', async () => {
    await post({ ...valid, start: 'Z' }).expect(400);
    await post({ ...valid, edge: { from: 'A', to: 'E' } }).expect(404);
    models.findById.mockResolvedValue(null);
    await post(valid, '99').expect(404);
  });
});
