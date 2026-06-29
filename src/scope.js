import Resolver from './resolver.js';

/**
 * Gerencia o ciclo de vida de serviços com escopo (Scoped) e o descarte de recursos.
 * @class
 */
export default class Scope {
  /** @type {import('./container.js').default} */
  #container;

  /** @type {Map<string, any>} */
  #instances = new Map();

  /** @type {Array<IDisposable>} */
  #disposables = [];

  /** @type {boolean} */
  #disposed = false;

  /**
   * @param {import('./container.js').default} container - Referência ao container pai.
   */
  constructor(container) {
    this.#container = container;
  }

  /**
   * Resolve um serviço dentro deste escopo.
   * @param {string} name - Nome do serviço.
   * @returns {any} A instância resolvida.
   * @throws {Error} Se o escopo já tiver sido descartado.
   */
  resolve(name) {
    if (this.#disposed) {
      throw new Error('Scope already disposed.');
    }
    return new Resolver(this.#container, this).resolve(name);
  }

  /**
   * Verifica se uma instância já foi resolvida e armazenada neste escopo.
   * @param {string} name - Nome do serviço.
   * @returns {boolean}
   */
  has(name) {
    return this.#instances.has(name);
  }

  /**
   * Recupera uma instância armazenada neste escopo.
   * @param {string} name - Nome do serviço.
   * @returns {any | undefined}
   */
  get(name) {
    return this.#instances.get(name);
  }

  /**
   * Armazena uma instância no escopo e a registra para descarte, se implementar IDisposable.
   * @param {string} name - Nome do serviço.
   * @param {any} instance - A instância do serviço.
   */
  set(name, instance) {
    this.#instances.set(name, instance);
    
    // Verifica se a instância implementa padrões de descarte
    if (
      typeof instance?.dispose === 'function' ||
      typeof instance?.[Symbol.dispose] === 'function'
    ) {
      this.#disposables.push(instance);
    }
  }

  /**
   * Descarta todas as instâncias gerenciadas por este escopo em ordem LIFO.
   * Garante que falhas em um serviço não impeçam o descarte dos demais.
   */
  dispose() {
    if (this.#disposed) {
      return;
    }

    // Itera em ordem reversa (LIFO) para descadeamento correto
    for (let i = this.#disposables.length - 1; i >= 0; i--) {
      const disposable = this.#disposables[i];

      // Prioriza o padrão moderno do ECMAScript, fallback para o legado
      const fn = disposable[Symbol.dispose] ?? disposable.dispose;

      try {
        fn.call(disposable);
      } catch (error) {
        // Isolamento de falha: loga o erro mas não interrompe o loop de descarte
        console.error(`[DI Container] Error disposing service:`, error);
      }
    }

    this.#instances.clear();
    this.#disposables.length = 0;
    this.#disposed = true;
  }
}