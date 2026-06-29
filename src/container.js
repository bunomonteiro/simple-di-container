import Scope from './scope.js';
import Resolver from './resolver.js';

/**
 * @typedef {'transient' | 'singleton' | 'scoped'} ScopeType
 * Define os escopos suportados pelo container.
 */

/**
 * @typedef {Function | (new (...args: any[]) => any)} ServiceDefinition
 * Pode ser uma Factory Function ou um Construtor de Classe.
 */

/**
 * @typedef {{ 
 *   definition: ServiceDefinition, 
 *   scope: ScopeType, 
 *   dependencies: string[] 
 * }} ServiceRegistration
 * Estrutura interna de armazenamento de um serviço registrado.
 */

/**
 * @typedef {Object} IDisposable
 * @property {Function} [dispose] - Método legado de descarte.
 * @property {Function} [Symbol.dispose] - Método moderno de descarte (ECMAScript).
 */

/**
 * Container de Injeção de Dependência (DI).
 * Gerencia o registro, resolução e ciclo de vida de serviços.
 * @class
 */
export default class Container {
  /**
   * Enumeração dos escopos suportados.
   * @readonly
   * @enum {ScopeType}
   */
  static SCOPES = Object.freeze({
    TRANSIENT: 'transient',
    SINGLETON: 'singleton',
    SCOPED: 'scoped'
  });

  /** @type {Map<string, ServiceRegistration>} */
  #services = new Map();

  /** @type {Map<string, any>} */
  #singletons = new Map();

  /**
   * Registra um serviço no container.
   * @param {string} name - Nome único do serviço (chave de resolução).
   * @param {ServiceDefinition} definition - Classe construtora ou Factory Function.
   * @param {ScopeType} scope - Escopo do serviço (transient, singleton, scoped).
   * @param {string[]} [dependencies=[]] - Lista de nomes das dependências a serem injetadas.
   * @returns {Container} Retorna a própria instância para suporte a Fluent API.
   * @throws {Error} Se o nome for vazio, já estiver registrado ou o escopo for inválido.
   */
  register(name, definition, scope, dependencies = []) {
    if (!name) throw new Error('Service name is required.');
    if (this.#services.has(name)) throw new Error(`Service "${name}" already registered.`);
    
    const validScopes = Object.values(Container.SCOPES);
    if (!validScopes.includes(scope)) {
      throw new Error(`Invalid scope "${scope}". Must be one of: ${validScopes.join(', ')}`);
    }

    this.#services.set(name, { definition, scope, dependencies });
    return this; 
  }

  /**
   * Cria um novo escopo (Scope) para resolução de serviços scoped.
   * @returns {Scope} Uma nova instância de escopo isolada.
   */
  createScope() {
    return new Scope(this);
  }

  /**
   * Resolve um serviço no escopo raiz (apenas transient e singleton são permitidos).
   * @param {string} name - Nome do serviço a ser resolvido.
   * @returns {any} A instância do serviço resolvido.
   * @throws {Error} Se o serviço não for encontrado ou exigir um escopo.
   */
  resolve(name) {
    return new Resolver(this, null).resolve(name);
  }

  /**
   * Recupera a definição de um serviço registrado (Uso interno do Resolver).
   * @param {string} name - Nome do serviço.
   * @returns {ServiceRegistration | undefined}
   */
  getService(name) {
    return this.#services.get(name);
  }

  /**
   * Recupera uma instância singleton armazenada (Uso interno do Resolver).
   * @param {string} name - Nome do serviço.
   * @returns {any | undefined}
   */
  getSingleton(name) {
    return this.#singletons.get(name);
  }

  /**
   * Armazena uma instância singleton (Uso interno do Resolver).
   * @param {string} name - Nome do serviço.
   * @param {any} instance - A instância a ser armazenada.
   */
  setSingleton(name, instance) {
    this.#singletons.set(name, instance);
  }
}