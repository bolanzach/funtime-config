import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {IsString, IsNumber, IsBoolean, IsObject} from 'class-validator';
import {FuntimeConfig, FuntimeSecretProperty} from './index';

describe('FuntimeConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FuntimeConfig.clear();
    process.env.NODE_ENV = 'test';
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('TEST_')) {
        delete process.env[key];
      }
    });
  });

  describe('load', () => {
    it('should load the correct config class based on NODE_ENV', async () => {
      class AppConfig extends FuntimeConfig {
        @IsString()
        TEST_ENV!: string;
      }

      class DevelopmentConfig extends AppConfig {
        @IsString()
        TEST_ENV = 'dev';
      }

      class ProductionConfig extends AppConfig {
        @IsString()
        TEST_ENV = 'prod';
      }

      FuntimeConfig.register(DevelopmentConfig, ProductionConfig);

      process.env.NODE_ENV = 'development';
      let result = await FuntimeConfig.load();
      expect(result).toHaveProperty('TEST_ENV', 'dev');

      process.env.NODE_ENV = 'production';
      result = await FuntimeConfig.load();
      expect(result).toHaveProperty('TEST_ENV', 'prod');
    })

    it('should load a specific config class when provided', async () => {
      class TestConfig extends FuntimeConfig {
        @IsString()
        TEST_ENV = 'test';
      }

      FuntimeConfig.register(TestConfig);
      const result = await FuntimeConfig.load(TestConfig);

      expect(result).toHaveProperty('TEST_ENV', 'test');
    })

    it('should load default values', async () => {
      class TestConfig extends FuntimeConfig {
        @IsString()
        TEST_STRING = 'Default App';

        @IsNumber()
        TEST_NUMBER = 3000;

        @IsBoolean()
        TEST_BOOL = true;

        @IsObject()
        TEST_COMPLEX_CONFIG = {
          nested: {
            key: 'value'
          },
          list: [1, 2, 3]
        }
      }

      FuntimeConfig.register(TestConfig)
      const result = await FuntimeConfig.load()

      expect(result).toHaveProperty('TEST_STRING', 'Default App');
      expect(result).toHaveProperty('TEST_NUMBER', 3000);
      expect(result).toHaveProperty('TEST_BOOL', true);
      expect(result).toHaveProperty('TEST_COMPLEX_CONFIG', {
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
        TEST_COMPLEX_CONFIG = {};

        @IsString()
        TEST_SECRET_VALUE = FuntimeSecretProperty;
      }

      process.env.TEST_APP_NAME = 'My Test App';
      process.env.TEST_PORT = '8080';
      process.env.TEST_BOOL_1 = 'true';
      process.env.TEST_BOOL_2 = 'TRue';
      process.env.TEST_SECRET_VALUE = 'supersecret';
      process.env.TEST_COMPLEX_CONFIG = JSON.stringify({
        nested: { key: 'value' },
        list: [1, 2, 3]
      });

      FuntimeConfig.register(TestConfig)
      const result = await FuntimeConfig.load()

      expect(result).toHaveProperty('TEST_APP_NAME', 'My Test App');
      expect(result).toHaveProperty('TEST_PORT', 8080);
      expect(result).toHaveProperty('TEST_BOOL_1', true);
      expect(result).toHaveProperty('TEST_BOOL_2', true);
      expect(result).toHaveProperty('TEST_SECRET_VALUE', 'supersecret');
      expect(result).toHaveProperty('TEST_COMPLEX_CONFIG', {
        nested: { key: 'value' },
        list: [1, 2, 3]
      });
    });

    it('should resolve function properties', async () => {
      class TestConfig extends FuntimeConfig {
        @IsString()
        TEST_APP_NAME = () => 'RESOLVED_VALUE';
      }

      FuntimeConfig.register(TestConfig)
      const result = await FuntimeConfig.load()

      expect(result).toHaveProperty('TEST_APP_NAME', 'RESOLVED_VALUE');
    });

    it('should work with inherited properties', async () => {
      class BaseConfig extends FuntimeConfig {
        @IsString()
        TEST_STR!: string;

        @IsNumber()
        TEST_NUM = 42;

        @IsBoolean()
        TEST_BOOL!: boolean;
      }

      class TestConfig extends BaseConfig {
        TEST_STR = 'test';
        TEST_NUM = 69
      }

      process.env.TEST_BOOL = 'TRUE';

      FuntimeConfig.register(TestConfig)
      const result = await FuntimeConfig.load()

      expect(result).toHaveProperty('TEST_STR', 'test');
      expect(result).toHaveProperty('TEST_NUM', 69);
      expect(result).toHaveProperty('TEST_BOOL', true);
    })
  });
});
