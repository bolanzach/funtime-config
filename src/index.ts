import { validateSync } from 'class-validator';
import { ClassConstructor, plainToInstance } from 'class-transformer';

export type FuntimePropertyInput = {
  property: string
}

export type FuntimeProperty = (input: FuntimePropertyInput) => Promise<any> | any;

/**
 * Symbol to mark properties that should be treated as secrets. Secrets should be injected via
 * environment variables and not hardcoded or checked into version control.
 */
export const FuntimeSecretProperty = Symbol('FuntimeSecretProperty');

export class FuntimeConfig {

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

  async load() {
    const configObj: Record<string, any> = this;

    // Parse environment variables with type coercion
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        configObj[key] = this.parseEnvValue(value);
      }
    }

    const instance = plainToInstance(this.constructor as ClassConstructor<object>, configObj);

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
