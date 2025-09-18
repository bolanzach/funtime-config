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
import {FuntimeConfig} from "./index";

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

Now, you can load the configuration based on the current environment.

```typescript
const config = new DevConfig();
await config.load();
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
    loadEnv('.env');
  };
}
````


## Development

```shell
npm install
```
