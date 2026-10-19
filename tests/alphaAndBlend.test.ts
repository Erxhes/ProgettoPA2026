import { DEFAULT_ALPHA, resolveAlpha } from '../src/config/alpha';
import { blendWeight } from '../src/services/WeightRequestService';

describe('resolveAlpha', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('accetta valori tra 0 e 1 (estremi esclusi)', () => {
    expect(resolveAlpha('0.5')).toBe(0.5);
    expect(resolveAlpha('0.01')).toBe(0.01);
    expect(resolveAlpha('0.99')).toBe(0.99);
  });

  it.each(['0', 'abc'])('usa 0.9 per il valore errato "%s"', (raw) => {
    expect(resolveAlpha(raw)).toBe(DEFAULT_ALPHA);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('blendWeight', () => {
  it('applica p = alpha * p_old + (1 - alpha) * p_new', () => {
    expect(blendWeight(8, 5, 0.9)).toBe(7.7);
    expect(blendWeight(3, 4, 0.9)).toBe(3.1);
    expect(blendWeight(10, 20, 0.5)).toBe(15);
  });
});
