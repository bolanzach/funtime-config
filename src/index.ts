import { validateSync } from 'class-validator';
import { ClassConstructor, plainToInstance } from 'class-transformer';

export type FuntimeProperty = () => Promise<any> | any;

export type FuntimeConfigConstructor = new () => FuntimeConfig;

/**
 * Symbol to mark properties that should be treated as secrets. Secrets should be injected via
 * environment variables and not hardcoded or checked into version control.
 */
export const FuntimeSecretProperty = Symbol('FuntimeSecretProperty');

export class FuntimeConfig {
  private static configs: Map<string, FuntimeConfigConstructor> = new Map();

  static register<T extends FuntimeConfig>(...config: Array<new () => T>) {
    for (const cfg of config) {
      const env = cfg.name.replace(/Config$/, '').toLowerCase();
      FuntimeConfig.configs.set(env, cfg);
    }
  }

  static clear() {
    FuntimeConfig.configs.clear();
  }

  private static parseEnvValue(value: string): any {
    // Try to parse booleans
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Try to parse numbers
    if (!isNaN(Number(value)) && value !== '') {
      return Number(value);
    }

    try {
      // Try to parse JSON
      return JSON.parse(value);
    } catch {
      // Not JSON
    }

    return value;
  }

  static async load(config?: FuntimeConfigConstructor): Promise<FuntimeConfig> {
    const nodeEnv = process.env.NODE_ENV;

    if (!config && !nodeEnv) {
      throw new Error('NODE_ENV environment variable is not set');
    }

    // Get config class based on NODE_ENV
    const ConfigClass = config ?? FuntimeConfig.configs.get(nodeEnv as string);
    if (!ConfigClass) {
      throw new Error(`No configuration registered for NODE_ENV="${nodeEnv}"`);
    }

    // Create instance of the appropriate config class
    const configInstance = new (ConfigClass as any)();
    const configObj: Record<string, any> = configInstance;

    // Parse environment variables with type coercion
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        configObj[key] = this.parseEnvValue(value);
      }
    }

    const instance = plainToInstance(ConfigClass as ClassConstructor<object>, configObj);

    // Resolve function properties
    for (const entry of Object.entries(instance)) {
      const [key, value] = entry;
      if (typeof value === 'function') {
        // @ts-ignore
        instance[key] = await instance[key]({ property: key });
      }
    }

    const errors = validateSync(instance);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => Object.values(e.constraints || {}).join(', ')).join('; ')}`);
    }
    return instance;
  }
}
