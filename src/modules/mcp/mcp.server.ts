// mcp.server: stdio entry point. Stdout carries the MCP protocol, so logs go to stderr.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { join } from 'node:path';
import { createBusinessVerification } from '../../index';
import { loadEnvWithFallback } from '../../config/env';
import { createStderrLogger } from '../../common/logger';
import { readEnvFile } from '../../cli/env-file';
import { buildRegulatoryRadarTool, buildScoreDisclosureTool, buildVerifyBusinessTool } from './mcp.tools';

export const MCP_SERVER_NAME = 'creva-score';
export const MCP_SERVER_VERSION = '0.1.0';

export function createMcpServer(): McpServer {
  const logger = createStderrLogger();
  const env = loadEnvWithFallback(readEnvFile(join(process.cwd(), '.env')));
  const setup = createBusinessVerification(env, logger);

  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });

  const verifyBusiness = buildVerifyBusinessTool(setup);
  server.registerTool(verifyBusiness.name, verifyBusiness.config, verifyBusiness.handler);

  const radar = buildRegulatoryRadarTool(setup);
  server.registerTool(radar.name, radar.config, radar.handler);

  const disclosure = buildScoreDisclosureTool(setup);
  server.registerTool(disclosure.name, disclosure.config, disclosure.handler);

  return server;
}

export async function main(): Promise<void> {
  await createMcpServer().connect(new StdioServerTransport());
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${MCP_SERVER_NAME}: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exit(1);
  });
}
