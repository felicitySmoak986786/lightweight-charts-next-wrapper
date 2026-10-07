import type { IndicatorDefinition } from '../types';

export interface TsIndicatorModule {
  default?: IndicatorDefinition;
  indicator?: IndicatorDefinition;
}

/** Type-safe helper for authoring custom TypeScript indicators. */
export function defineIndicator(definition: IndicatorDefinition): IndicatorDefinition {
  return definition;
}

/**
 * Runtime loader for custom TypeScript/JavaScript indicators.
 *
 * Indicators are authored with {@link defineIndicator} (or via
 * `registerIndicator`) and can either be imported statically by the host app or
 * loaded lazily from a URL. The URL is intentionally not bundled so plugin
 * authors can ship indicators independently of the platform build.
 */
export class TsIndicatorRuntime {
  /** Load an indicator from an ES module URL. */
  async loadFromUrl(url: string): Promise<IndicatorDefinition> {
    if (typeof window === 'undefined') {
      throw new Error('TsIndicatorRuntime.loadFromUrl can only run in the browser');
    }
    const module = (await import(/* webpackIgnore: true */ url)) as TsIndicatorModule;
    const definition = module.default ?? module.indicator;
    if (!definition?.id || typeof definition.compute !== 'function') {
      throw new Error(`Module at ${url} does not export a valid indicator definition`);
    }
    return definition;
  }

  /** Validate a definition loaded from any source. */
  validate(definition: IndicatorDefinition): void {
    if (!definition.id) throw new Error('Indicator is missing an id');
    if (typeof definition.compute !== 'function') throw new Error('Indicator is missing a compute() function');
    if (!Array.isArray(definition.params)) definition.params = [];
    if (typeof definition.overlay !== 'boolean') definition.overlay = true;
  }
}
