// mcp-probe: drives the MCP server over stdio so it can be exercised without an MCP client.

import { spawn } from 'node:child_process';
import { join } from 'node:path';

export interface ProbeReport {
  server: string;
  protocol: string;
  tools: string[];
  called?: { name: string; isError: boolean; text: string };
  stdoutLines: number;
  stdoutAllJson: boolean;
  stderr: string;
}

interface JsonRpcMessage {
  id?: number;
  result?: {
    serverInfo?: { name?: string; version?: string };
    protocolVersion?: string;
    tools?: Array<{ name: string }>;
    isError?: boolean;
    content?: Array<{ text?: string }>;
  };
  error?: { message?: string };
}

export function parseProbeArgs(argv: string[]): { tool?: string; args: Record<string, unknown> } {
  const parsed: { tool?: string; args: Record<string, unknown> } = { args: {} };

  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--tool') parsed.tool = argv[index + 1];
    if (argv[index] === '--args') {
      const raw = argv[index + 1];
      if (raw !== undefined) {
        try {
          parsed.args = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          parsed.args = {};
        }
      }
    }
  }
  return parsed;
}

export function summarise(stdout: string, stderr: string): ProbeReport {
  const lines = stdout.split('\n').filter((line) => line.trim() !== '');
  const messages: JsonRpcMessage[] = [];
  let allJson = true;

  for (const line of lines) {
    try {
      messages.push(JSON.parse(line) as JsonRpcMessage);
    } catch {
      allJson = false;
    }
  }

  const init = messages.find((message) => message.id === 1);
  const list = messages.find((message) => message.id === 2);
  const call = messages.find((message) => message.id === 3);

  const report: ProbeReport = {
    server: `${init?.result?.serverInfo?.name ?? '?'} v${init?.result?.serverInfo?.version ?? '?'}`,
    protocol: init?.result?.protocolVersion ?? '?',
    tools: (list?.result?.tools ?? []).map((tool) => tool.name),
    stdoutLines: lines.length,
    stdoutAllJson: allJson,
    stderr: stderr.trim(),
  };

  if (call?.result) {
    report.called = {
      name: 'tools/call',
      isError: call.result.isError === true,
      text: call.result.content?.[0]?.text ?? '',
    };
  }
  return report;
}

export function render(report: ProbeReport, toolName?: string): string {
  const lines = [
    'Sonda MCP',
    '',
    `  servidor        ${report.server}`,
    `  protocolo       ${report.protocol}`,
    `  herramientas    ${report.tools.join(', ') || '(ninguna)'}`,
    `  stdout          ${report.stdoutLines} líneas, solo JSON-RPC: ${report.stdoutAllJson ? 'sí' : 'NO'}`,
    `  stderr          ${report.stderr === '' ? 'vacío' : `${report.stderr.split('\n').length} línea(s)`}`,
  ];

  if (report.called) {
    lines.push('', `  ${toolName ?? 'herramienta'} → ${report.called.isError ? 'isError' : 'ok'}`);
    for (const line of report.called.text.split('\n').slice(0, 24)) lines.push(`    ${line}`);
  }

  lines.push('', report.stdoutAllJson ? '  El canal del protocolo quedó limpio.' : '  ⚠️ Algo escribió en stdout que no es JSON-RPC.');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const { tool, args } = parseProbeArgs(process.argv.slice(2));
  const child = spawn(process.execPath, [join(__dirname, '../modules/mcp/mcp.server.js')], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += String(chunk)));
  child.stderr.on('data', (chunk) => (stderr += String(chunk)));

  const send = (message: unknown): void => {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-probe', version: '1' } },
  });
  await wait(500);

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  await wait(500);

  if (tool !== undefined) {
    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: tool, arguments: args } });
    await wait(20000);
  }

  child.kill();
  process.stdout.write(`${render(summarise(stdout, stderr), tool)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`mcp-probe: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exit(1);
  });
}
