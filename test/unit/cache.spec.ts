import { MemoryCacheStore } from '../../src/common/cache/memory-cache';
import { sourceOk } from '../../src/common/types/source-result.types';

describe('MemoryCacheStore', () => {
  it('returns a stored value before it expires', async () => {
    let now = 1_000;
    const cache = new MemoryCacheStore(() => now);
    await cache.set('k', sourceOk('s', { a: 1 }), 500);

    now = 1_400;
    await expect(cache.get('k')).resolves.toMatchObject({ data: { a: 1 } });
  });

  it('drops a value once the TTL has passed', async () => {
    let now = 1_000;
    const cache = new MemoryCacheStore(() => now);
    await cache.set('k', sourceOk('s', { a: 1 }), 500);

    now = 1_500;
    await expect(cache.get('k')).resolves.toBeUndefined();
  });

  it('stores nothing when the TTL is zero', async () => {
    const cache = new MemoryCacheStore();
    await cache.set('k', sourceOk('s', { a: 1 }), 0);

    await expect(cache.get('k')).resolves.toBeUndefined();
  });
});
