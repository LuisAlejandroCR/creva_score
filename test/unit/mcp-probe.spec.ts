import { parseProbeArgs, render, summarise } from '../../src/cli/mcp-probe';

const initLine = JSON.stringify({
  id: 1,
  result: { serverInfo: { name: 'creva-score', version: '0.1.0' }, protocolVersion: '2025-06-18' },
});
const listLine = JSON.stringify({
  id: 2,
  result: { tools: [{ name: 'creva_verify_business' }, { name: 'creva_regulatory_radar' }] },
});
const callLine = JSON.stringify({
  id: 3,
  result: { isError: false, content: [{ type: 'text', text: '{\n "status": "verified"\n}' }] },
});

describe('parseProbeArgs', () => {
  it('reports malformed arguments instead of quietly sending none', () => {
    // PowerShell passes escaped quotes through literally, so this is what a mistyped
    // invocation actually looks like. Swallowing it made a quoting error read as a
    // schema error, and cost two live calls to diagnose.
    const broken = String.raw`{\"business_name\":\"ACME\"}`;
    const parsed = parseProbeArgs(['--tool', 'creva_verify_business', '--args', broken]);

    expect(parsed.args).toEqual({});
    expect(parsed.argsError).toBe(broken);
  });

  it('leaves argsError unset when the arguments parse', () => {
    const parsed = parseProbeArgs(['--tool', 'creva_verify_business', '--args', '{"business_name":"ACME"}']);

    expect(parsed.args).toEqual({ business_name: 'ACME' });
    expect(parsed.argsError).toBeUndefined();
  });

  it('reads the tool name and its arguments', () => {
    expect(parseProbeArgs(['--tool', 'creva_verify_business', '--args', '{"business_name":"ACME"}'])).toEqual({
      tool: 'creva_verify_business',
      args: { business_name: 'ACME' },
    });
  });

  it('falls back to empty arguments when the JSON is malformed, and says so', () => {
    expect(parseProbeArgs(['--tool', 'x', '--args', 'not json'])).toEqual({
      tool: 'x',
      args: {},
      argsError: 'not json',
    });
  });

  it('returns no tool when none is asked for', () => {
    expect(parseProbeArgs([])).toEqual({ args: {} });
  });
});

describe('summarise', () => {
  it('reads the handshake, the tool list and the call', () => {
    const report = summarise([initLine, listLine, callLine].join('\n'), '');

    expect(report.server).toBe('creva-score v0.1.0');
    expect(report.protocol).toBe('2025-06-18');
    expect(report.tools).toEqual(['creva_verify_business', 'creva_regulatory_radar']);
    expect(report.called).toMatchObject({ isError: false });
    expect(report.stdoutAllJson).toBe(true);
  });

  it('flags anything on stdout that is not JSON-RPC', () => {
    const report = summarise([initLine, 'console.log se coló aquí'].join('\n'), '');

    expect(report.stdoutAllJson).toBe(false);
  });

  it('does not invent a call that never happened', () => {
    expect(summarise([initLine, listLine].join('\n'), '').called).toBeUndefined();
  });
});

describe('render', () => {
  it('states plainly when the protocol channel stayed clean', () => {
    expect(render(summarise([initLine, listLine].join('\n'), ''))).toContain('El canal del protocolo quedó limpio.');
  });

  it('warns when something polluted stdout', () => {
    expect(render(summarise([initLine, 'ruido'].join('\n'), ''))).toContain('⚠️');
  });
});
