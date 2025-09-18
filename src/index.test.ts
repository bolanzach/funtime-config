import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {IsString, IsNumber, IsBoolean, IsObject} from 'class-validator';
import {FuntimeConfig, FuntimeSecretProperty} from './index';

describe('FuntimeConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('TEST_')) {
        delete process.env[key];
      }
    });
  });

  describe('load', () => {
    it('should load default values', async () => {
      class TestConfig extends FuntimeConfig {
        @IsString()
        TEST_STRING = 'Default App';

        @IsNumber()
        TEST_NUMBER = 3000;

        @IsBoolean()
        TEST_BOOL = true;

        @IsObject()
        COMPLEX_CONFIG = {
          nested: {
            key: 'value'
          },
          list: [1, 2, 3]
        }
      }

      const config = new TestConfig();
      const result = await config.load();

      expect(result).toHaveProperty('TEST_STRING', 'Default App');
      expect(result).toHaveProperty('TEST_NUMBER', 3000);
      expect(result).toHaveProperty('TEST_BOOL', true);
      expect(result).toHaveProperty('COMPLEX_CONFIG', {
        nested: { key: 'value' },
        list: [1, 2, 3]
      });
    });

    it('should load configuration from environment variables', async () => {
      class TestConfig extends FuntimeConfig {
        @IsString()
        TEST_APP_NAME = 'Default App';

        @IsNumber()
        TEST_PORT = 3000;

        @IsBoolean()
        TEST_BOOL_1 = false;

        @IsBoolean()
        TEST_BOOL_2 = false;

        @IsObject()
        COMPLEX_CONFIG = {};

        @IsString()
        SECRET_VALUE = FuntimeSecretProperty;
      }

      process.env.TEST_APP_NAME = 'My Test App';
      process.env.TEST_PORT = '8080';
      process.env.TEST_BOOL_1 = 'true';
      process.env.TEST_BOOL_2 = 'TRue';
      process.env.SECRET_VALUE = 'supersecret';
      process.env.COMPLEX_CONFIG = JSON.stringify({
        nested: { key: 'value' },
        list: [1, 2, 3]
      });

      const config = new TestConfig();
      const result = await config.load();

      expect(result).toHaveProperty('TEST_APP_NAME', 'My Test App');
      expect(result).toHaveProperty('TEST_PORT', 8080);
      expect(result).toHaveProperty('TEST_BOOL_1', true);
      expect(result).toHaveProperty('TEST_BOOL_2', true);
      expect(result).toHaveProperty('SECRET_VALUE', 'supersecret');
      expect(result).toHaveProperty('COMPLEX_CONFIG', {
        nested: { key: 'value' },
        list: [1, 2, 3]
      });
    });

    it('should resolve function properties', async () => {
      class TestConfig extends FuntimeConfig {
        @IsString()
        TEST_APP_NAME = ({ property }: { property: string }) => `RESOLVED_${property}`;
      }

      const config = new TestConfig();
      const result = await config.load();

      expect(result).toHaveProperty('TEST_APP_NAME', 'RESOLVED_TEST_APP_NAME');
    });
  });
});
