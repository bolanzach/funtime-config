# Funtime-Config

Funtime-Config is a configuration management tool designed to simplify the process of managing and deploying configurations across multiple environments.

## Installation

```shell
npm install funtime-config
```

## Usage

Define your base application configuration.
Your class should extend `FuntimeConfig`.
This serves as both the interface and the default configuration for your application.

```typescript
import { FuntimeConfig, IsString, IsBoolean } from "funtime-config";

class AppConfig extends FuntimeConfig {
  @IsString()
  PORT = 3000;
  
  @IsString()
  DB_HOST!: string;
  
  @IsBoolean()
  IS_TEST = false;
}
```

Notice that each property is decorated with a validation decorator.
This is what enables runtime validation of your configuration.

Next, define your environment-specific configurations.

```typescript
class DevConfig extends AppConfig {
  DB_HOST = "localhost";
}

class TestConfig extends AppConfig {
  IS_TEST = true;
  DB_HOST = "test.db";
}

class ProdConfig extends AppConfig {
  DB_HOST = "prod.db.server";
  PORT = 80;
}
````

Now you instantiate a loader, passing to it the env configs.
The `load()` method will automatically detect the current environment via `NODE_ENV`.

```typescript
const configLoader = new FuntimeConfigLoader({
  configs: [DevConfig, ProdConfig, TestConfig],
});
const appConfig = await configLoader.load();

// process.env.NODE_ENV === 'dev' loads DevConfig
// process.env.NODE_ENV === 'prod' loads ProdConfig
// process.env.NODE_ENV === 'test' loads TestConfig
````

You can also explicitly specify the environment to load.

```typescript
const configLoader = new FuntimeConfigLoader({ configs: [] });
const appConfig = await configLoader.load(ProdConfig);
````

## Secret Management

Secrets such as passwords and API keys should NEVER be hardcoded in your configuration files.
Instead, use environment variables or a secret management service to inject these values at runtime.

You have a few options.

### (Preferred) Inject via environment variables

Your Funtime-Config will automatically read from environment variables that match the property names.

```typescript
class AppConfig extends FuntimeConfig {
  @IsString()
  DB_PASSWORD = FuntimeSecretProperty;
}
```

### (Alternate) Resolve async properties

You can also define async properties that fetch values.
This is not reserved for secrets and can be used for any property that requires async resolution.

```typescript
class AppConfig extends FuntimeConfig {
  @IsString()
  DB_PASSWORD = async () => {
    // fetch from secret manager
    return await fetchDBSecret();
  };

  @IsString()
  API_KEY = async () => {
    // you can be a sicko and fetch from a .env file
    const env = await loadEnvFile('.env');
    return env.API_KEY;
  };
}
````

## Local Development

When developing locally, you can create a `LocalConfig` class that won't be committed to source control (via gitignore).
Specify the local config in the loader.

```typescript
// local.config.ts (add this file to .gitignore)
export class LocalConfig extends FuntimeConfig {
  @IsString()
  API_URL = 'http://localhost:3000';
}
```

Then load it like so:

```typescript
const configLoader = new FuntimeConfigLoader({
  configs: [...],
  localConfigPath: './local.config',
});
````

If the `NODE_ENV` is set to `local`, the loader will attempt to load the local config.
