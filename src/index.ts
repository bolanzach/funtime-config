import { validateSync } from 'class-validator';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import fs from 'fs';
import path from 'path';

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

export type FuntimeConfigLoaderOptions<T extends FuntimeConfig> = {
  /**
   * Environment-specific configuration classes to register.
   */
  configs: Array<ClassConstructor<T>>;

  /**
   * Path to a local configuration file used for development.
   */
  localConfigPath?: string;

  /**
   * Optional path to a .env file to load environment variables from.
   * By default, looks for a `.env` file in the current working directory. This can be disabled
   * by setting to `false`.
   */
  envFilePath?: string | boolean;
}

/**
 * Symbol to mark properties that should be treated as secrets. Secrets should be injected via
 * environment variables and not hardcoded or checked into version control.
 */
export const FuntimeSecretProperty = Symbol('FuntimeSecretProperty');

export class FuntimeConfig {
  [key: string]: ConfigValue;
}

export class FuntimeConfigLoader<T extends FuntimeConfig> {
  private configs: Map<string, ClassConstructor<T>> = new Map();

  constructor(private options: FuntimeConfigLoaderOptions<T>) {
    this.register(...options.configs)
  }

  register(...config: Array<ClassConstructor<T>>) {
    for (const cfg of config) {
      const env = cfg.name
        .toLowerCase()
        .replace(/config$/, '');
      this.configs.set(env, cfg);
    }
  }

  async load(config?: ClassConstructor<T>): Promise<T> {
    // Load env file if specified
    if (this.options.envFilePath) {
      const filePath = this.options.envFilePath === true ? '.env' : this.options.envFilePath;
      this.loadEnvFile(filePath);
    }

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
    const configInstance = new ConfigClass();

    // Parse environment variables with type coercion
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        // @ts-ignore
        configInstance[key] = this.parseEnvValue(value);
      }
    }

    const instance = plainToInstance(ConfigClass, configInstance) as T;

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

  private loadEnvFile(envFilePath: string): void {
    try {
      const resolvedPath = path.resolve(envFilePath);
      if (!fs.existsSync(resolvedPath)) {
        return;
      }

      const envContent = fs.readFileSync(resolvedPath, 'utf-8');
      const lines = envContent.split('\n');

      for (const line of lines) {
        // Skip empty lines and comments
        if (!line || line.trim().startsWith('#')) {
          continue;
        }

        // Parse KEY=VALUE format
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();

          // Remove surrounding quotes if present
          const unquotedValue = value
            .replace(/^["']/, '')
            .replace(/["']$/, '');

          process.env[key.trim()] = unquotedValue;
        }
      }
    } catch (error) {
      console.error(`Error loading environment file: ${error}`);
    }
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
