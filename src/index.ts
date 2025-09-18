import { validateSync } from 'class-validator';
import { ClassConstructor, plainToInstance } from 'class-transformer';

// Re-export commonly used validators for convenience
export {
  IsString,
  IsNumber,
  IsBoolean,
  IsObject,
  IsArray,
  IsEmail,
  IsUrl,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsPositive,
  IsNegative,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsEnum,
  IsDate,
  IsUUID,
  IsJSON,
  ValidateNested
} from 'class-validator';

export type FuntimeProperty = () => Promise<any> | any;

type ConfigValue =
  | string
  | number
  | boolean
  | symbol
  | FuntimeProperty
  | { [key: string]: ConfigValue }
  | ConfigValue[];

export type FuntimeConfigConstructor = ClassConstructor<FuntimeConfig>;

export type FuntimeConfigLoaderOptions = {
  /**
   * Environment-specific configuration classes to register.
   */
  configs: Array<FuntimeConfigConstructor>;

  /**
   * Path to a local configuration file used for development.
   */
  localConfigPath?: string;

  /**
   * Optional path to a .env file to load environment variables from.
   */
  envFilePath?: string;
}

/**
 * Symbol to mark properties that should be treated as secrets. Secrets should be injected via
 * environment variables and not hardcoded or checked into version control.
 */
export const FuntimeSecretProperty = Symbol('FuntimeSecretProperty');

export class FuntimeConfig {
  [key: string]: ConfigValue;
}

export class FuntimeConfigLoader {
  private configs: Map<string, FuntimeConfigConstructor | string> = new Map();

  constructor(private options: FuntimeConfigLoaderOptions) {
    this.register(...options.configs)
  }

  register(...config: Array<FuntimeConfigConstructor>) {
    for (const cfg of config) {
      const env = cfg.name
        .toLowerCase()
        .replace(/config$/, '');
      this.configs.set(env, cfg);
    }
  }

  async load(config?: FuntimeConfigConstructor): Promise<FuntimeConfig> {
    const nodeEnv = process.env.NODE_ENV;

    if (!config && !nodeEnv) {
      throw new Error('NODE_ENV environment variable is not set');
    }

    try {
      const module = await import(this.options.localConfigPath ?? '');
      const LocalConfig = module.LocalConfig || module.default;
      if (LocalConfig && LocalConfig.prototype instanceof FuntimeConfig) {
        this.configs.set('local', LocalConfig);
      }
    } catch {
      // Local config doesn't exist or can't be loaded
    }

    // Get config class based on NODE_ENV
    const ConfigClass = config ?? this.configs.get(nodeEnv as string);
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

    const instance = plainToInstance(ConfigClass as FuntimeConfigConstructor, configObj);

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

  private parseEnvValue(value: string): any {
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
}
