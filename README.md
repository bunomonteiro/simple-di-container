# Simple DI Container

A lightweight, zero-dependency Dependency Injection (DI) container for JavaScript and Node.js applications. 

Built with modern ECMAScript standards in mind, featuring explicit scope management and native resource disposal.

## Features

- **Service Lifetimes:** Transient, Singleton, and Scoped.
- **Explicit Scope Management:** Predictable lifecycle for HTTP requests and background jobs.
- **Modern Resource Disposal:** Native support for `Symbol.dispose` (ECMAScript Explicit Resource Management) and legacy `.dispose()`.
- **Robust Resolution:** Automatic dependency graph resolution and circular dependency detection.
- **Fail-Fast Configuration:** Validates scopes and dependencies at registration time.
- **Flexible Definitions:** Supports both ES6 Classes and Factory Functions.
- **Zero Dependencies:** 100% vanilla JavaScript, ideal for self-hosted and minimal environments.

## Installation

```bash
npm install simple-di-container
```

## Quick Start

```javascript
import { Container } from 'simple-di-container';

const container = new Container();

class Logger {
  log(message) { console.log(message); }
}

class UserService {
  constructor(logger) { this.logger = logger; }
  getUsers() {
    this.logger.log('Loading users...');
    return [];
  }
}

// Register services
container.register('logger', Logger, Container.SCOPES.SINGLETON);
container.register('userService', UserService, Container.SCOPES.TRANSIENT, ['logger']);

// Resolve and use
const userService = container.resolve('userService');
userService.getUsers();
```

## Service Lifetimes

### Transient
Creates a new instance every time the service is resolved.
```javascript
container.register('logger', Logger, Container.SCOPES.TRANSIENT);
const a = container.resolve('logger');
const b = container.resolve('logger');
console.log(a === b); // false
```

### Singleton
Creates a single instance and reuses it for the lifetime of the container.
```javascript
container.register('config', ConfigService, Container.SCOPES.SINGLETON);
const a = container.resolve('config');
const b = container.resolve('config');
console.log(a === b); // true
```

### Scoped
Creates one instance per explicit scope. Ideal for HTTP requests, database transactions, or Unit of Work patterns.
```javascript
container.register('requestContext', RequestContext, Container.SCOPES.SCOPED);

// Create an explicit scope
const scope1 = container.createScope();
const a1 = scope1.resolve('requestContext');
const a2 = scope1.resolve('requestContext');
console.log(a1 === a2); // true (same scope)

const scope2 = container.createScope();
const b1 = scope2.resolve('requestContext');
console.log(a1 === b1); // false (different scopes)

// Clean up resources
scope1.dispose();
scope2.dispose();
```

## Modern Resource Disposal (Symbol.dispose)

The container automatically tracks scoped services that implement disposal methods and calls them in reverse order (LIFO) when the scope is disposed. It supports both the modern ECMAScript `Symbol.dispose` and the legacy `.dispose()` method.

*Note: If a service throws an error during disposal, the container catches it, logs it, and continues disposing the remaining services to prevent memory/connection leaks.*

```javascript
class DatabaseConnection {
  constructor() { this.isConnected = true; }
  
  // Modern ECMAScript disposal
  [Symbol.dispose]() { 
    this.isConnected = false; 
    console.log('Connection closed.');
  }
}

container.register('db', DatabaseConnection, Container.SCOPES.SCOPED);

const scope = container.createScope();
const db = scope.resolve('db');
console.log(db.isConnected); // true

scope.dispose(); 
// Logs: "Connection closed."
```

## API Reference

### `container.register(name, definition, scope, [dependencies])`
Registers a service. Validates the scope immediately (Fail-Fast).
- `name` *(string)*: Service identifier.
- `definition` *(Class | Function)*: Class constructor or factory function.
- `scope` *(string)*: Use `Container.SCOPES.TRANSIENT`, `SINGLETON`, or `SCOPED`.
- `dependencies` *(string[])*: Optional array of dependency names to inject.

### `container.resolve(name)`
Resolves a service from the root container. Only `transient` and `singleton` services can be resolved from the root.

### `container.createScope()`
Creates a new, isolated scope for resolving `scoped` services. Returns a `Scope` instance.

### `scope.resolve(name)`
Resolves a service within the specific scope.

### `scope.dispose()`
Destroys the scope, calling the disposal method (`Symbol.dispose` or `dispose`) on all tracked scoped services in LIFO order.

## Framework Integration (Express.js Example)

Here is how to properly integrate the scoped lifecycle with an Express application:

```javascript
import express from 'express';
import { Container } from 'simple-di-container';

const app = express();
const container = new Container();

class RequestContext {
  constructor() { this.requestId = crypto.randomUUID(); }
  [Symbol.dispose]() { console.log(`Request ${this.requestId} context disposed.`); }
}

container.register('requestContext', RequestContext, Container.SCOPES.SCOPED);

// Middleware: Create scope at the beginning of the request
app.use((req, res, next) => {
  req.scope = container.createScope();
  
  // Ensure scope is disposed when the response finishes
  res.on('finish', () => req.scope.dispose());
  res.on('close', () => req.scope.dispose());
  
  next();
});

app.get('/', (req, res) => {
  // Resolve using the request-specific scope
  const context = req.scope.resolve('requestContext');
  res.json({ requestId: context.requestId });
});

app.listen(3000);
```

## Error Handling

The container is designed to fail fast and provide clear error messages:

- **Service Not Found:** `Service "missing" not found.`
- **Invalid Scope (Fail-Fast):** `Invalid scope "invalid". Must be one of: transient, singleton, scoped`
- **Scoped without Scope:** `Scoped service "requestContext" requires a scope.`
- **Circular Dependency:** `Circular dependency: a -> b -> c -> a`

## Design Goals

This library intentionally focuses on simplicity, predictability, and zero external dependencies. 

It does **not** include:
- Decorators or Reflection metadata (keeps it lightweight and transpiler-friendly).
- Auto-registration or service scanning.
- Async factories (keeps the resolution graph synchronous and predictable).
- Framework-specific integrations (framework agnostic by design).

## License

MIT
