import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const runtime = 'nodejs';

const MAX_SOURCE_BYTES = 200_000;

function run(command: string, args: string[], cwd?: string, timeoutMs = 180_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + String(error) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

async function dotnetAvailable(): Promise<boolean> {
  const result = await run('dotnet', ['--version'], undefined, 15_000);
  return result.code === 0;
}

/**
 * Compiles a C# indicator to WebAssembly.
 *
 * Requires the .NET SDK with the `wasm-tools` workload. When the SDK is absent
 * the route responds with actionable setup instructions rather than failing
 * silently, so the UI can guide the developer.
 */
export async function POST(request: Request) {
  if (!(await dotnetAvailable())) {
    return NextResponse.json(
      {
        error: 'dotnet_missing',
        message:
          'The .NET SDK is not installed in this environment. Install it and run `dotnet workload install wasm-tools`, then restart the server. You can also precompile indicators and load them via CsIndicatorBridge.loadFromUrl().',
        docs: 'https://learn.microsoft.com/dotnet/core/tools/',
      },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const source = (body as { source?: unknown })?.source;
  if (typeof source !== 'string' || source.trim().length === 0) {
    return NextResponse.json({ error: 'source_required' }, { status: 400 });
  }
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    return NextResponse.json({ error: 'source_too_large' }, { status: 413 });
  }

  const buildScript = path.resolve(process.cwd(), 'cs-indicators', 'build.sh');
  if (!existsSync(buildScript)) {
    return NextResponse.json({ error: 'build_script_missing', path: buildScript }, { status: 500 });
  }

  const workDir = await mkdtemp(path.join(tmpdir(), 'cs-indicator-'));
  const sourceFile = path.join(workDir, 'Indicator.cs');
  await writeFile(sourceFile, source, 'utf8');

  const result = await run('bash', [buildScript, sourceFile, workDir], workDir);
  if (result.code !== 0) {
    return NextResponse.json(
      { error: 'compile_failed', stdout: result.stdout, stderr: result.stderr },
      { status: 500 },
    );
  }

  const wasmPath = path.join(workDir, 'Indicator.wasm');
  if (!existsSync(wasmPath)) {
    return NextResponse.json({ error: 'wasm_not_produced', stdout: result.stdout }, { status: 500 });
  }

  const wasm = await readFile(wasmPath);
  return NextResponse.json({ wasmBase64: wasm.toString('base64') });
}
