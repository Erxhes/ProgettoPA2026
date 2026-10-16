import { Database } from '../src/config/database';
import { ModelDao } from '../src/dao/ModelDao';
import { UserDao } from '../src/dao/UserDao';
import { Edge, GraphModel, ModelVersion } from '../src/models';
import { ModelService } from '../src/services/ModelService';

/** La costruzione del grafo dura 30 ms, il calcolo del percorso è immediato. */
jest.mock('node-dijkstra', () => ({
  __esModule: true,
  default: class {
    constructor() {
      const end = Date.now() + 30;
      while (Date.now() < end) {
        /* attesa attiva */
      }
    }
    path() {
      return { path: ['A', 'B'], cost: 1 };
    }
  },
}));
jest.mock('../src/dao/UserDao');
jest.mock('../src/dao/ModelDao');

describe('ModelService.execute: tempo di esecuzione', () => {
  it('include la costruzione del grafo, non solo la ricerca del percorso', async () => {
    jest
      .spyOn(Database.getInstance(), 'transaction')
      .mockImplementation(((fn: (tx: unknown) => Promise<unknown>) => fn({})) as never);
    jest.mocked(ModelDao).findById.mockResolvedValue({ id: 1 } as GraphModel);
    jest.mocked(ModelDao).findLatestVersion.mockResolvedValue({
      versionNumber: 1,
      nodeCount: 2,
      edgeCount: 1,
      edges: [{ fromNode: 'A', toNode: 'B', weight: '1' }],
    } as unknown as ModelVersion & { edges: Edge[] });
    jest.mocked(UserDao).deductTokens.mockResolvedValue(10);

    const result = await ModelService.execute(1, 1, 'A', 'B');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(25);
  });
});
