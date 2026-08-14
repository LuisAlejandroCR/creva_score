import { isAbsolute, join, resolve } from 'node:path';
import { anchorCachePath, envSources, packageRoot } from '../../src/modules/mcp/mcp.env';

const DIST = join('C:', 'proyecto', 'dist', 'modules', 'mcp');

describe('mcp server environment', () => {
  it('looks for .env next to the build output as well as in the working directory', () => {
    // An MCP client spawns the server from its own directory; without this the
    // credentials are invisible and the demo answers "no pudimos consultar".
    const sources = envSources(DIST, join('C:', 'otro', 'lugar'));

    expect(sources).toEqual([join('C:', 'proyecto', '.env'), join('C:', 'otro', 'lugar', '.env')]);
  });

  it('lets the working directory win when both files define a value', () => {
    expect(envSources(DIST, join('C:', 'x')).at(-1)).toBe(join('C:', 'x', '.env'));
  });

  it('anchors a relative cache path to the package root', () => {
    // Otherwise the warm cache lands in the client's directory and every call goes out live.
    const anchored = anchorCachePath({ CACHE_FILE_PATH: './.cache/creva.json' }, packageRoot(DIST));

    expect(anchored.CACHE_FILE_PATH).toBe(join('C:', 'proyecto', './.cache/creva.json'));
  });

  it('leaves an absolute cache path exactly as configured', () => {
    // resolve() yields whatever "absolute" means on the platform running the test.
    // A hard-coded Windows path is relative on Linux, which is how this went red on CI.
    const absolute = resolve('cache', 'creva.json');
    expect(isAbsolute(absolute)).toBe(true);

    expect(anchorCachePath({ CACHE_FILE_PATH: absolute }, resolve('proyecto')).CACHE_FILE_PATH).toBe(absolute);
  });

  it('leaves the environment untouched when no cache path is configured', () => {
    expect(anchorCachePath({ CROMA_API_KEY: 'x' }, join('C:', 'proyecto'))).toEqual({ CROMA_API_KEY: 'x' });
  });
});
