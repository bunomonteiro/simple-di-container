# Simple DI Container

A lightweight Dependency Injection (DI) container for JavaScript and Node.js applications.

Supports:

* Transient services
* Singleton services
* Scoped services
* Dependency resolution
* Circular dependency detection
* Classes and factory functions
* Zero dependencies

---

## Installation

```bash
npm install simple-di-container
```

---

## Import

```javascript
import Container from 'simple-di-container';
```

---

## Quick Start

```javascript
import Container from 'simple-di-container';

const container = new Container();

class Logger {
  log(message) {
    console.log(message);
  }
}

class UserService {
  constructor(logger) {
    this.logger = logger;
  }

  getUsers() {
    this.logger.log('Loading users...');
    return [];
  }
}

container.register(
  'logger',
  Logger,
  'singleton'
);

container.register(
  'userService',
  UserService,
  'transient',
  ['logger']
);

const userService = container.resolve('userService');

userService.getUsers();
```

---

# Service Lifetimes

## Transient

Creates a new instance every time the service is resolved.

```javascript
container.register(
  'logger',
  Logger,
  'transient'
);

const a = container.resolve('logger');
const b = container.resolve('logger');

console.log(a === b);
// false
```

---

## Singleton

Creates a single instance and reuses it for the lifetime of the container.

```javascript
container.register(
  'config',
  ConfigService,
  'singleton'
);

const a = container.resolve('config');
const b = container.resolve('config');

console.log(a === b);
// true
```

---

## Scoped

Creates one instance per context.

Useful for:

* HTTP requests
* Background jobs
* Sessions
* Unit of Work patterns

```javascript
container.register(
  'requestContext',
  RequestContext,
  'scoped'
);

const requestA = {};
const requestB = {};

const a1 = container.resolve(
  'requestContext',
  requestA
);

const a2 = container.resolve(
  'requestContext',
  requestA
);

const b1 = container.resolve(
  'requestContext',
  requestB
);

console.log(a1 === a2);
// true

console.log(a1 === b1);
// false
```

---

# Registering Services

## Class Registration

```javascript
container.register(
  'userRepository',
  UserRepository,
  'singleton'
);
```

---

## Registration with Dependencies

```javascript
container.register(
  'userRepository',
  UserRepository,
  'singleton',
  ['logger']
);

container.register(
  'userService',
  UserService,
  'transient',
  ['userRepository']
);
```

Dependencies are resolved automatically when the service is instantiated.

---

## Factory Functions

Factory functions are supported out of the box.

```javascript
container.register(
  'config',
  () => ({
    apiUrl: 'https://api.example.com',
    timeout: 5000
  }),
  'singleton'
);

const config = container.resolve('config');
```

Factories can also receive dependencies:

```javascript
container.register(
  'logger',
  Logger,
  'singleton'
);

container.register(
  'config',
  logger => {
    logger.log('Creating configuration');

    return {
      apiUrl: 'https://api.example.com'
    };
  },
  'singleton',
  ['logger']
);
```

---

# API

## register(name, definition, scope, dependencies)

Registers a service.

### Parameters

| Parameter    | Type     | Description                    |
| ------------ | -------- | ------------------------------ |
| name         | string   | Service identifier             |
| definition   | Function | Class or factory function      |
| scope        | string   | transient, singleton or scoped |
| dependencies | string[] | Service dependencies           |

### Example

```javascript
container.register(
  'emailService',
  EmailService,
  'singleton',
  ['logger', 'config']
);
```

---

## resolve(name, context)

Resolves a service and all its dependencies.

### Parameters

| Parameter | Required | Description                       |
| --------- | -------- | --------------------------------- |
| name      | Yes      | Service identifier                |
| context   | No       | Required only for scoped services |

### Example

```javascript
const service = container.resolve(
  'emailService'
);
```

Scoped service:

```javascript
const request = {};

const service = container.resolve(
  'requestContext',
  request
);
```

---

## clearContext(context)

Removes all scoped instances associated with a context.

### Example

```javascript
container.clearContext(request);
```

After clearing a context, resolving a scoped service again creates a new instance.

---

# Circular Dependency Detection

The container automatically detects circular dependencies.

Example:

```javascript
container.register(
  'a',
  A,
  'transient',
  ['b']
);

container.register(
  'b',
  B,
  'transient',
  ['c']
);

container.register(
  'c',
  C,
  'transient',
  ['a']
);

container.resolve('a');
```

Throws:

```text
Circular dependency detected: a -> b -> c -> a
```

Self-referencing services are also detected:

```javascript
container.register(
  'service',
  Service,
  'transient',
  ['service']
);

container.resolve('service');
```

Throws:

```text
Circular dependency detected: service -> service
```

---

# Error Handling

## Service Not Found

```javascript
container.resolve('missing');
```

Throws:

```text
Service "missing" not found.
```

---

## Invalid Scope

```javascript
container.register(
  'service',
  Service,
  'invalid'
);
```

Throws:

```text
Invalid scope "invalid".
```

---

## Scoped Service Without Context

```javascript
container.resolve('requestContext');
```

Throws:

```text
Scoped service "requestContext" requires a context.
```

---

# Express Example

```javascript
import express from 'express';
import Container from 'simple-di-container';

const app = express();
const container = new Container();

class RequestContext {
  constructor() {
    this.createdAt = new Date();
  }
}

container.register(
  'requestContext',
  RequestContext,
  'scoped'
);

app.use((req, res, next) => {
  req.scope = req;
  next();
});

app.get('/', (req, res) => {
  const context = container.resolve(
    'requestContext',
    req.scope
  );

  res.json({
    createdAt: context.createdAt
  });
});

app.use((req, res, next) => {
  container.clearContext(req.scope);
  next();
});
```

---

# Design Goals

This library intentionally focuses on simplicity.

It does not include:

* Decorators
* Reflection metadata
* Auto-registration
* Async factories
* Service scanning
* Framework-specific integrations

The goal is to provide a small, predictable and dependency-free DI container.

---

# License

MIT
