import test from 'node:test';
import assert from 'node:assert/strict';

import Container from '../src/container.js';

test('register should throw for invalid scope', () => {
  const container = new Container();

  class Service {}

  assert.throws(
    () => {
      container.register(
        'service',
        Service,
        'invalid-scope'
      );
    },
    /Invalid scope/
  );
});

test('should resolve factory function', () => {
  const container = new Container();

  container.register(
    'config',
    () => ({
      url: 'https://api.test'
    }),
    'singleton'
  );

  const config = container.resolve('config');

  assert.deepEqual(
    config,
    {
      url: 'https://api.test'
    }
  );
});

test('resolve should throw when service does not exist', () => {
  const container = new Container();

  assert.throws(
    () => container.resolve('missing'),
    {
      message: 'Service "missing" not found.'
    }
  );
});

test('should throw for circular dependency', () => {
  const container = new Container();

  class A {}
  class B {}
  class C {}

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

  assert.throws(
    () => container.resolve('a'),
    {
      message:
        'Circular dependency detected: a -> b -> c -> a'
    }
  );
});

test('should detect self dependency', () => {
  const container = new Container();

  class Service {}

  container.register(
    'service',
    Service,
    'transient',
    ['service']
  );

  assert.throws(
    () => container.resolve('service'),
    {
      message:
        'Circular dependency detected: service -> service'
    }
  );
});

test('transient should create a new instance every time', () => {
  const container = new Container();

  class Service { }

  container.register(
    'service',
    Service,
    'transient'
  );

  const a = container.resolve('service');
  const b = container.resolve('service');

  assert.notEqual(a, b);
});

test('transient should resolve dependencies', () => {
  const container = new Container();

  class Dependency { }

  class Service {
    constructor(dep) {
      this.dep = dep;
    }
  }

  container.register(
    'dependency',
    Dependency,
    'transient'
  );

  container.register(
    'service',
    Service,
    'transient',
    ['dependency']
  );

  const service = container.resolve('service');

  assert.ok(service.dep instanceof Dependency);
});

test('singleton should return the same instance', () => {
  const container = new Container();

  class Service { }

  container.register(
    'service',
    Service,
    'singleton'
  );

  const a = container.resolve('service');
  const b = container.resolve('service');

  assert.equal(a, b);
});

test('singleton should instantiate only once', () => {
  const container = new Container();

  let calls = 0;

  class Service {
    constructor() {
      calls++;
    }
  }

  container.register(
    'service',
    Service,
    'singleton'
  );

  container.resolve('service');
  container.resolve('service');
  container.resolve('service');

  assert.equal(calls, 1);
});

test('singleton should resolve dependencies only once', () => {
  const container = new Container();

  let dependencyCalls = 0;

  class Dependency {
    constructor() {
      dependencyCalls++;
    }
  }

  class Service {
    constructor(dep) {
      this.dep = dep;
    }
  }

  container.register(
    'dependency',
    Dependency,
    'singleton'
  );

  container.register(
    'service',
    Service,
    'singleton',
    ['dependency']
  );

  container.resolve('service');
  container.resolve('service');

  assert.equal(dependencyCalls, 1);
});

test('singleton factory should execute only once', () => {
  const container = new Container();

  let calls = 0;

  container.register(
    'config',
    () => {
      calls++;

      return {
        value: 123
      };
    },
    'singleton'
  );

  container.resolve('config');
  container.resolve('config');
  container.resolve('config');

  assert.equal(calls, 1);
});

test('scoped should throw when context is missing', () => {
  const container = new Container();

  class Service { }

  container.register(
    'service',
    Service,
    'scoped'
  );

  assert.throws(
    () => container.resolve('service'),
    {
      message: 'Scoped service "service" requires a context.'
    }
  );
});

test('scoped should create one instance per context', () => {
  const container = new Container();

  class Service { }

  const contextA = {};
  const contextB = {};

  container.register(
    'service',
    Service,
    'scoped'
  );

  const a1 = container.resolve('service', contextA);
  const a2 = container.resolve('service', contextA);

  const b1 = container.resolve('service', contextB);

  assert.equal(a1, a2);
  assert.notEqual(a1, b1);
});

test('scoped should resolve dependencies using same context', () => {
  const container = new Container();

  class Dependency { }

  class Service {
    constructor(dep) {
      this.dep = dep;
    }
  }

  const context = {};

  container.register(
    'dependency',
    Dependency,
    'scoped'
  );

  container.register(
    'service',
    Service,
    'scoped',
    ['dependency']
  );

  const service = container.resolve(
    'service',
    context
  );

  const dependency = container.resolve(
    'dependency',
    context
  );

  assert.equal(service.dep, dependency);
});

test('should resolve transitive dependencies', () => {
  const container = new Container();

  class C { }

  class B {
    constructor(c) {
      this.c = c;
    }
  }

  class A {
    constructor(b) {
      this.b = b;
    }
  }

  container.register(
    'c',
    C,
    'transient'
  );

  container.register(
    'b',
    B,
    'transient',
    ['c']
  );

  container.register(
    'a',
    A,
    'transient',
    ['b']
  );

  const a = container.resolve('a');

  assert.ok(a.b instanceof B);
  assert.ok(a.b.c instanceof C);
});

test('clearContext should force recreation of scoped instances', () => {
  const container = new Container();

  class Service {}

  const context = {};

  container.register(
    'service',
    Service,
    'scoped'
  );

  const first = container.resolve(
    'service',
    context
  );

  container.clearContext(context);

  const second = container.resolve(
    'service',
    context
  );

  assert.notEqual(first, second);
});

test('clearContext should not throw when context does not exist', () => {
  const container = new Container();

  assert.doesNotThrow(() => {
    container.clearContext({});
  });
});
