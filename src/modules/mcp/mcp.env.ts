// mcp.env: where the server looks for its configuration when a client launches it.

import { isAbsolute, join } from 'node:path';

export function packageRoot(dirname: string): string {
  return join(dirname, '..', '..', '..');
}

// An MCP client spawns this server from its own working directory, so the project's
// .env is looked for next to the build output too. The working directory still wins.
export function envSources(dirname: string, cwd: string): string[] {
  return [join(packageRoot(dirname), '.env'), join(cwd, '.env')];
}

// A relative cache path would land in whatever directory the client happens to run in,
// so the warm cache would be invisible and every call would go out live.
export function anchorCachePath(env: NodeJS.ProcessEnv, root: string): NodeJS.ProcessEnv {
  const configured = env.CACHE_FILE_PATH;
  if (configured === undefined || configured === '' || isAbsolute(configured)) return env;
  return { ...env, CACHE_FILE_PATH: join(root, configured) };
}
