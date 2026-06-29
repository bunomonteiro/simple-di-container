import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Container from '../src/container.js';

describe('Container DI - Registro e Configuração', () => {
  let container;

  beforeEach(() => {
    container = new Container();
  });

  test('deve lançar erro ao registrar sem nome', () => {
    assert.throws(() => container.register('', class {}, 'transient'), /Service name is required/);
  });

  test('deve lançar erro ao registrar nome duplicado', () => {
    container.register('svc', class {}, 'transient');
    assert.throws(() => container.register('svc', class {}, 'transient'), /already registered/);
  });

  test('deve lançar erro ao registrar com escopo inválido (Fail-Fast)', () => {
    assert.throws(
      () => container.register('svc', class {}, 'invalid_scope'),
      /Invalid scope/
    );
  });

  test('deve suportar encadeamento (Fluent API) no registro', () => {
    const result = container.register('svc', class {}, 'transient');
    assert.strictEqual(result, container, 'register deve retornar a instância do container');
  });
});

describe('Container DI - Resolução e Injeção', () => {
  let container;

  beforeEach(() => {
    container = new Container();
  });

  test('deve lançar erro ao resolver serviço inexistente', () => {
    assert.throws(() => container.resolve('missing'), /Service "missing" not found/);
  });

  test('deve resolver Factory Function sem dependências', () => {
    container.register('config', () => ({ env: 'test' }), Container.SCOPES.SINGLETON);
    assert.deepStrictEqual(container.resolve('config'), { env: 'test' });
  });

  test('deve resolver Factory Function com dependências injetadas', () => {
    container.register('logger', () => ({ log: () => {} }), Container.SCOPES.SINGLETON);
    container.register('config', (logger) => ({ logger, env: 'prod' }), Container.SCOPES.SINGLETON, ['logger']);
    
    const config = container.resolve('config');
    assert.strictEqual(config.env, 'prod');
    assert.ok(typeof config.logger.log === 'function');
  });

  test('deve resolver grafo de dependências transitivas (A -> B -> C)', () => {
    class C {}
    class B { constructor(c) { this.c = c; } }
    class A { constructor(b) { this.b = b; } }

    container.register('c', C, Container.SCOPES.TRANSIENT);
    container.register('b', B, Container.SCOPES.TRANSIENT, ['c']);
    container.register('a', A, Container.SCOPES.TRANSIENT, ['b']);

    const a = container.resolve('a');
    assert.ok(a.b instanceof B);
    assert.ok(a.b.c instanceof C);
  });
});

describe('Container DI - Ciclos de Vida (Scopes)', () => {
  let container;

  beforeEach(() => {
    container = new Container();
  });

  test('Transient: deve criar nova instância a cada resolução', () => {
    container.register('svc', class {}, Container.SCOPES.TRANSIENT);
    assert.notStrictEqual(container.resolve('svc'), container.resolve('svc'));
  });

  test('Singleton: deve retornar a mesma instância e executar factory uma vez', () => {
    let calls = 0;
    container.register('svc', () => { calls++; return { id: 1 }; }, Container.SCOPES.SINGLETON);
    
    const a = container.resolve('svc');
    const b = container.resolve('svc');
    
    assert.strictEqual(a, b);
    assert.strictEqual(calls, 1);
  });

  test('Scoped: deve lançar erro se resolvido fora de um escopo (Root)', () => {
    container.register('svc', class {}, Container.SCOPES.SCOPED);
    assert.throws(() => container.resolve('svc'), /requires a scope/);
  });

  test('Scoped: deve reutilizar instância dentro do mesmo escopo', () => {
    container.register('svc', class {}, Container.SCOPES.SCOPED);
    const scope = container.createScope();
    assert.strictEqual(scope.resolve('svc'), scope.resolve('svc'));
  });

  test('Scoped: deve isolar instâncias entre escopos diferentes', () => {
    container.register('svc', class {}, Container.SCOPES.SCOPED);
    const scope1 = container.createScope();
    const scope2 = container.createScope();
    assert.notStrictEqual(scope1.resolve('svc'), scope2.resolve('svc'));
  });

  test('Scoped: dependências devem compartilhar o mesmo escopo', () => {
    class Dep {}
    class Svc { constructor(dep) { this.dep = dep; } }
    
    container.register('dep', Dep, Container.SCOPES.SCOPED);
    container.register('svc', Svc, Container.SCOPES.SCOPED, ['dep']);
    
    const scope = container.createScope();
    const svc = scope.resolve('svc');
    const dep = scope.resolve('dep');
    
    assert.strictEqual(svc.dep, dep);
  });
});

describe('Container DI - Detecção de Dependência Circular', () => {
  let container;

  beforeEach(() => {
    container = new Container();
  });

  test('deve detectar auto-dependência', () => {
    container.register('svc', class {}, Container.SCOPES.TRANSIENT, ['svc']);
    assert.throws(() => container.resolve('svc'), /Circular dependency: svc -> svc/);
  });

  test('deve detectar ciclo longo (A -> B -> C -> A)', () => {
    container.register('a', class {}, Container.SCOPES.TRANSIENT, ['b']);
    container.register('b', class {}, Container.SCOPES.TRANSIENT, ['c']);
    container.register('c', class {}, Container.SCOPES.TRANSIENT, ['a']);
    
    assert.throws(() => container.resolve('a'), /Circular dependency: a -> b -> c -> a/);
  });
});

describe('Scope - Ciclo de Vida e Descarte (Dispose)', () => {
  let container;

  beforeEach(() => {
    container = new Container();
  });

  test('deve chamar método legado .dispose() ao fechar o escopo', () => {
    let disposed = false;
    class Svc { dispose() { disposed = true; } }
    
    container.register('svc', Svc, Container.SCOPES.SCOPED);
    const scope = container.createScope();
    scope.resolve('svc');
    scope.dispose();
    
    assert.strictEqual(disposed, true);
  });

  test('deve chamar Symbol.dispose (ECMAScript moderno) ao fechar o escopo', () => {
    let disposed = false;
    class Svc { [Symbol.dispose]() { disposed = true; } }
    
    container.register('svc', Svc, Container.SCOPES.SCOPED);
    const scope = container.createScope();
    scope.resolve('svc');
    scope.dispose();
    
    assert.strictEqual(disposed, true);
  });

  test('deve ser idempotente (chamar dispose múltiplas vezes não deve gerar erro)', () => {
    container.register('svc', class {}, Container.SCOPES.SCOPED);
    const scope = container.createScope();
    scope.resolve('svc');
    
    assert.doesNotThrow(() => {
      scope.dispose();
      scope.dispose(); // Segunda chamada deve ser ignorada silenciosamente
    });
  });

  test('não deve permitir resolução após o descarte', () => {
    container.register('svc', class {}, Container.SCOPES.SCOPED);
    const scope = container.createScope();
    scope.dispose();
    
    assert.throws(() => scope.resolve('svc'), /Scope already disposed/);
  });

  test('CRÍTICO: deve isolar falhas e continuar descartando outros serviços', () => {
    let successDisposed = false;
    
    class FailingSvc { [Symbol.dispose]() { throw new Error('Falha catastrófica'); } }
    class SuccessSvc { [Symbol.dispose]() { successDisposed = true; } }
    
    container.register('fail', FailingSvc, Container.SCOPES.SCOPED);
    container.register('success', SuccessSvc, Container.SCOPES.SCOPED);
    
    const scope = container.createScope();
    scope.resolve('fail');
    scope.resolve('success');
    
    // Suprime o erro do console para não poluir o output do teste
    const originalError = console.error;
    console.error = () => {}; 
    
    assert.doesNotThrow(() => scope.dispose(), 'O dispose do scope não deve propagar a exceção');
    
    console.error = originalError;
    
    assert.strictEqual(successDisposed, true, 'O segundo serviço DEVE ser descartado mesmo se o primeiro falhar');
  });
});