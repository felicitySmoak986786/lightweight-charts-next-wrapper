import type { Candle } from '../../types';
import type {
  IndicatorDefinition,
  IndicatorParamSpec,
  IndicatorResult,
  IndicatorUtils,
} from '../types';

/** Metadata supplied alongside a compiled C# indicator. */
export interface CsIndicatorMetadata {
  id: string;
  name: string;
  description?: string;
  /** Render on the main pane (true) or in a dedicated pane (false). */
  overlay: boolean;
  params: IndicatorParamSpec[];
}

/**
 * Shape of the WASM module produced from a `.cs` indicator.
 *
 * The module must export:
 *  - `memory: WebAssembly.Memory`
 *  - `alloc(length: i32): i32`
 *  - `free(ptr: i32, length: i32): void`
 *  - `compute(inputPtr: i32, inputLength: i32): i32`
 *  - `result_len(): i32`
 *
 * `compute` receives a UTF-8 JSON payload `{ candles, params }` and returns a
 * pointer to a UTF-8 JSON {@link IndicatorResult}.
 */
interface CsWasmExports {
  memory: WebAssembly.Memory;
  alloc(length: number): number;
  free(ptr: number, length: number): void;
  compute(inputPtr: number, inputLength: number): number;
  result_len(): number;
}

const CS_ABI_DOC: CsIndicatorMetadata = {
  id: 'cs_custom',
  name: 'C# Indicator',
  overlay: true,
  params: [],
};

/**
 * Bridges indicators written in C# (compiled to WebAssembly) into the
 * TypeScript indicator pipeline. Compilation can happen ahead of time or on the
 * server via the bundled `/api/indicators/cs/compile` route (requires the .NET
 * SDK with the `wasm-tools` workload).
 */
export class CsIndicatorBridge {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  /** Load a precompiled `.wasm` indicator from a URL. */
  async loadFromUrl(url: string, metadata: CsIndicatorMetadata = CS_ABI_DOC): Promise<IndicatorDefinition> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch C# indicator wasm: ${response.status}`);
    const module = await WebAssembly.compile(await response.arrayBuffer());
    return this.fromModule(module, metadata);
  }

  /** Wrap an already-compiled WASM module as an indicator definition. */
  async fromModule(module: WebAssembly.Module, metadata: CsIndicatorMetadata = CS_ABI_DOC): Promise<IndicatorDefinition> {
    const instance = await WebAssembly.instantiate(module, {
      env: {
        // Minimal host imports some runtimes expect. C# NativeAOT modules may
        // require additional imports depending on the build configuration.
        abort: () => {
          throw new Error('C# indicator aborted');
        },
      },
    });
    const exports = instance.exports as unknown as CsWasmExports;
    this.assertAbi(exports);
    return this.wrap(exports, metadata);
  }

  /**
   * Compile a `.cs` source string through the server compile endpoint and load
   * the returned wasm. The endpoint is intentionally pluggable so platforms can
   * host compilation however they prefer (build server, cache, prebuilt blobs).
   */
  async compileAndLoad(
    source: string,
    metadata: CsIndicatorMetadata = CS_ABI_DOC,
    endpoint = '/api/indicators/cs/compile',
  ): Promise<IndicatorDefinition> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `C# indicator compilation failed (${response.status}). ${detail || 'Is the .NET SDK available?'}`,
      );
    }

    const payload = (await response.json()) as { wasmBase64?: string; url?: string };
    if (payload.url) return this.loadFromUrl(payload.url, metadata);
    if (payload.wasmBase64) {
      const bytes = Uint8Array.from(atob(payload.wasmBase64), (char) => char.charCodeAt(0));
      const module = await WebAssembly.compile(bytes);
      return this.fromModule(module, metadata);
    }
    throw new Error('Compile endpoint returned neither `wasmBase64` nor `url`');
  }

  private wrap(exports: CsWasmExports, metadata: CsIndicatorMetadata): IndicatorDefinition {
    const bridge = this;
    return {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      overlay: metadata.overlay,
      params: metadata.params,
      compute({ candles, params }: { candles: Candle[]; params: Record<string, unknown> }): IndicatorResult {
        const input = JSON.stringify({ candles, params });
        const inputBytes = bridge.encoder.encode(input);
        const inputPtr = exports.alloc(inputBytes.length);
        new Uint8Array(exports.memory.buffer, inputPtr, inputBytes.length).set(inputBytes);
        try {
          const resultPtr = exports.compute(inputPtr, inputBytes.length);
          const resultLength = exports.result_len();
          if (!resultPtr || resultLength <= 0) return { plots: [] };
          const resultView = new Uint8Array(exports.memory.buffer, resultPtr, resultLength);
          const json = bridge.decoder.decode(resultView);
          return JSON.parse(json) as IndicatorResult;
        } finally {
          exports.free(inputPtr, inputBytes.length);
        }
      },
    };
  }

  private assertAbi(exports: CsWasmExports): void {
    const required: Array<keyof CsWasmExports> = ['memory', 'alloc', 'free', 'compute', 'result_len'];
    for (const key of required) {
      if (!(key in exports)) {
        throw new Error(`C# indicator wasm is missing the required export: ${String(key)}`);
      }
    }
    if (!(exports.memory instanceof WebAssembly.Memory)) {
      throw new Error('C# indicator wasm `memory` export is not a WebAssembly.Memory');
    }
  }
}

// Keep the utility type referenced for documentation consumers.
export type { IndicatorUtils };
