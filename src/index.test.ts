import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FuntimeConfig,
  FuntimeConfigLoader,
  FuntimeInjectProperty,
  IsString,
  IsNumber,
  IsBoolean,
  IsObject,
  getConfig, FuntimeResolveProperty,
} from './index';

describe('FuntimeConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      const configLoader = new FuntimeConfigLoader<AppConfig>({
        configs: [DevelopmentConfig, ProductionConfig],
      })

      process.env.NODE_ENV = 'development';
      let result = await configLoader.load();
      expect(result).toHaveProperty('TEST_ENV', 'dev');

      process.env.NODE_ENV = 'production';
      result = await configLoader.load();
      expect(result).toHaveProperty('TEST_ENV', 'prod');
    })

    it('should load the local config when NODE_ENV is local', async () => {
      const configLoader = new FuntimeConfigLoader({
        configs: [],
        localConfigPath: './test/local.config'
      });

      process.env.NODE_ENV = 'local';

      const result = await configLoader.load();
      expect(result).toHaveProperty('TEST_STRING', 'local_string');
    })

    it('should load a specific config class when provided', async () => {
      class TestConfig extends FuntimeConfig {
        @IsString()
        TEST_ENV = 'test';
      }

      const configLoader = new FuntimeConfigLoader({
        configs: [TestConfig]
      });
      const result = await configLoader.load(TestConfig);

      expect(result).toHaveProperty('TEST_ENV', 'test');
    })

    it('should load a env file if specified', async () => {
      class TestConfig extends FuntimeConfig {
        @IsString()
        TEST_ENV_FILE!: string;
      }

      const configLoader = new FuntimeConfigLoader({
        configs: [TestConfig],
        envFilePath: './test/test.env'
      });

      const result = await configLoader.load();

      expect(result).toHaveProperty('TEST_ENV_FILE', 'test.env_file.loaded_from_test_env');
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

      const configLoader = new FuntimeConfigLoader({
        configs: [TestConfig]
      })
      const result = await configLoader.load()

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
        TEST_SECRET_VALUE = FuntimeInjectProperty<string>();
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

      const configLoader = new FuntimeConfigLoader({
        configs: [TestConfig]
      })
      const result = await configLoader.load()

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
        @IsNumber()
        TEST_NUMBER = 42;

        @IsString()
        TEST_SECRET = FuntimeInjectProperty<string>();

        @IsString()
        TEST_APP_NAME = FuntimeResolveProperty(async () => 'RESOLVED_VALUE');

        @IsObject()
        TEST_RESOLVED_OBJ = FuntimeResolveProperty(() => {
          return {
            fromNumber: this.TEST_NUMBER,
          }
        });

        @IsString()
        TEST_RESOLVED_SECRET = FuntimeResolveProperty(() => this.TEST_SECRET)
      }

      process.env.TEST_SECRET = 'mysecret';

      const configLoader = new FuntimeConfigLoader({
        configs: [TestConfig]
      });
      const result = await configLoader.load()

      expect(result).toHaveProperty('TEST_APP_NAME', 'RESOLVED_VALUE');
      expect(result).toHaveProperty('TEST_RESOLVED_OBJ', { fromNumber: 42 });
      expect(result).toHaveProperty('TEST_RESOLVED_SECRET', 'mysecret');
    });

    it('should work with inherited properties', async () => {
      class BaseConfig extends FuntimeConfig {
        @IsString()
        TEST_STR!: string;

        @IsNumber()
        TEST_NUM = 42;

        @IsBoolean()
        TEST_BOOL!: boolean;

        @IsObject()
        TEST_OBJ = { key: 'value_from_obj' };

        @IsNumber()
        TEST_RESOLVED = 100;
      }

      class TestConfig extends BaseConfig {
        TEST_STR = 'test';
        TEST_NUM = 69
        TEST_RESOLVED = FuntimeResolveProperty(() => this.TEST_NUM * 2);
      }

      process.env.TEST_BOOL = 'TRUE';

      const configLoader = new FuntimeConfigLoader({
        configs: [TestConfig]
      });
      const result = await configLoader.load()

      expect(result).toHaveProperty('TEST_STR', 'test');
      expect(result).toHaveProperty('TEST_NUM', 69);
      expect(result).toHaveProperty('TEST_BOOL', true);
      expect(result).toHaveProperty('TEST_OBJ', { key: 'value_from_obj' });
      expect(result).toHaveProperty('TEST_RESOLVED', 138);
    })

    it('should have a global config', async () => {
      class TestConfig extends FuntimeConfig {
        @IsString()
        TEST_PROP = 'prop_value';
      }

      const configLoader = new FuntimeConfigLoader({
        configs: [TestConfig]
      });
      await configLoader.load();

      const config = getConfig<TestConfig>();

      expect(config).toHaveProperty('TEST_PROP', 'prop_value');
    })
  });
});
