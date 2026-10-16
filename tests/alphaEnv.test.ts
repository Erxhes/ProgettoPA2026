/** Verifica che env.alpha sia letto davvero all'avvio dalla variabile ALPHA (modulo ricaricato a ogni prova). */
describe('env.alpha all\'avvio', () => {
  const original = process.env.ALPHA;

  /** Carica da zero src/config/env con il valore di ALPHA indicato (undefined = variabile assente). */
  function loadAlpha(raw: string | undefined): number {
    if (raw === undefined) delete process.env.ALPHA;
    else process.env.ALPHA = raw;
    let alpha = Number.NaN;
    jest.isolateModules(() => {
      // evita che dotenv rilegga un eventuale file .env locale
      jest.doMock('dotenv', () => ({ __esModule: true, default: { config: jest.fn() } }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      alpha = (require('../src/config/env') as typeof import('../src/config/env')).env.alpha;
    });
    return alpha;
  }

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (original === undefined) delete process.env.ALPHA;
    else process.env.ALPHA = original;
  });

  it('ALPHA=0.5 usa 0.5', () => {
    expect(loadAlpha('0.5')).toBe(0.5);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each(['abc', '0', '1'])('ALPHA="%s" usa 0.9', (raw) => {
    expect(loadAlpha(raw)).toBe(0.9);
    expect(console.warn).toHaveBeenCalled();
  });

  it('ALPHA assente usa 0.9', () => {
    expect(loadAlpha(undefined)).toBe(0.9);
  });
});
