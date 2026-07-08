# @phinehas-labs/flow-orchestrator

A lightweight, framework-agnostic engine designed to define, scan, generate, and execute ordered API integration flows. Built with full TypeScript support, type safety, and seamless NestJS compatibility.

---

## Features

- **Framework Agnostic**: The core orchestration engine does not depend on any web framework.
- **Topological Sorting**: Automatically analyzes dependencies between endpoints and runs them in the correct sequence.
- **Dynamic Data Injection**: Extract data from previous API responses using dot-notation, apply selection strategies, filter fields, and inject them into subsequent request payloads (body, query, headers, or params).
- **Conditional Execution**: Use expressions (e.g. `steps.create_user.body.active === true`) to conditionally run steps.
- **State Preservation**: Easily capture response fields into global variables or environment settings.
- **Declarative YAML Generation**: Auto-generate beautiful API Flow YAML definition sheets from scanned decorators.
- **NestJS Support**: Drop-in NestJS decorator scanning, controllers, and modules out of the box.

---

## Installation

```bash
pnpm add @phinehas-labs/flow-orchestrator
# or
npm install @phinehas-labs/flow-orchestrator
# or
yarn add @phinehas-labs/flow-orchestrator
```

Make sure to install `reflect-metadata` in your project if you plan to use decorators:
```bash
pnpm add reflect-metadata
```

---

## Standalone Usage (Framework-Agnostic)

You can define steps manually and execute them without any framework bindings:

```typescript
import { Orchestrator } from '@phinehas-labs/flow-orchestrator';

// Initialize the Orchestrator
const orchestrator = new Orchestrator({
  baseUrl: 'https://api.myproject.local/v1',
  logger: console // Plug in any logger implementing standard Logger interface
});

// Define step metadata manually
orchestrator.getMetadataExtractor().addStep({
  id: 'create_user',
  path: '/users',
  method: 'POST',
  controller: 'UserController',
  handlerName: 'create',
  dependencies: [],
  request: {
    body: { name: 'John Doe', role: 'admin' }
  }
});

orchestrator.getMetadataExtractor().addStep({
  id: 'send_welcome_email',
  path: '/email/welcome',
  method: 'POST',
  controller: 'EmailController',
  handlerName: 'sendWelcome',
  dependencies: [
    {
      endpointId: 'create_user',
      when: 'steps.create_user.status === 201',
      inject: [
        {
          select: 'body.email',
          assignTo: 'body.toEmail'
        }
      ]
    }
  ]
});

// Generate Flow Definition YAML
const flowYaml = orchestrator.generateYaml('UserOnboardingFlow');
console.log(flowYaml);

// Execute the Flow
const state = await orchestrator.executeFlow(JSON.parse(flowYaml));
console.log(state);
```

---

## NestJS Integration

If you are using NestJS, you can decorate your controllers and expose the flow automatically:

### 1. Decorate Controller Methods

Use `@Step`, `@DependsOn`, and `@Store` decorators to configure the endpoints:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { Step, DependsOn, Store } from '@phinehas-labs/flow-orchestrator';

@Controller('users')
export class UserController {

  @Post('create')
  @Step('create_user')
  @Store({ select: 'body.id', as: 'env.USER_ID' })
  createUser(@Body() dto: CreateUserDto) {
    return { id: 'usr_998', email: dto.email, active: true };
  }
}

@Controller('wallets')
export class WalletController {

  @Post('initialize')
  @Step('init_wallet')
  @DependsOn([
    {
      endpointId: 'create_user',
      when: 'steps.create_user.body.active === true',
      inject: [
        { select: 'body.id', assignTo: 'body.userId' }
      ]
    }
  ])
  initWallet() {
    return { success: true };
  }
}
```

### 2. Import the Module

Import `OrchestratorModule` into your `AppModule`:

```typescript
import { Module } from '@nestjs/common';
import { OrchestratorModule } from '@phinehas-labs/flow-orchestrator';

@Module({
  imports: [
    OrchestratorModule.forRoot({
      flowName: 'StockBillFlow',
      outputPath: './api-flow.yaml', // Automatically write flow definition to file on bootstrap
      baseUrl: 'http://localhost:3000'
    }),
  ],
})
export class AppModule {}
```

This will automatically expose the GET endpoint `/api-flow` containing the fully compiled YAML spec.

---

## Configuration API

The `Orchestrator` constructor accepts:

```typescript
interface OrchestratorOptions {
  baseUrl?: string;             // Base URL for executing HTTP requests
  logger?: Logger;               // Custom logger (defaults to console)
  mappingEngine?: MappingEngine;   // Custom mapping logic
  metadataExtractor?: MetadataExtractor; // Step collector
  flowExecutor?: FlowExecutor;   // Execution engine
  yamlGenerator?: YamlGenerator; // YAML compiler
}
```

---

## License

MIT © Phinehas Labs
