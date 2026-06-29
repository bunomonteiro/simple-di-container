/**
 * Motor de resolução de dependências.
 * Responsável por traversar o grafo, detectar ciclos e instanciar os serviços.
 * @class
 */
export default class Resolver {
  /** @type {import('./container.js').default} */
  #container;

  /** @type {import('./scope.js').default | null} */
  #scope;

  /**
   * @param {import('./container.js').default} container - O container principal.
   * @param {import('./scope.js').default | null} scope - O escopo ativo (null se for resolução raiz).
   */
  constructor(container, scope) {
    this.#container = container;
    this.#scope = scope;
  }

  /**
   * Ponto de entrada público para resolução.
   * @param {string} name - Nome do serviço a ser resolvido.
   * @returns {any} A instância do serviço.
   */
  resolve(name) {
    return this.#resolve(name, []);
  }

  /**
   * Resolução recursiva interna com rastreamento de caminho para detecção de ciclos.
   * @param {string} name - Nome do serviço.
   * @param {string[]} path - Caminho atual da pilha de resolução.
   * @returns {any}
   * @throws {Error} Se o serviço não for encontrado ou houver dependência circular.
   */
  #resolve(name, path) {
    const service = this.#container.getService(name);
    if (!service) {
      throw new Error(`Service "${name}" not found.`);
    }

    if (path.includes(name)) {
      throw new Error(
        `Circular dependency: ${[...path, name].join(' -> ')}`
      );
    }

    const nextPath = [...path, name];

    switch (service.scope) {
      case 'transient':
        return this.#create(service, nextPath);
      case 'singleton':
        return this.#resolveSingleton(name, service, nextPath);
      case 'scoped':
        return this.#resolveScoped(name, service, nextPath);
      default:
        throw new Error(`Unknown scope "${service.scope}".`);
    }
  }

  /**
   * Resolve e cacheia serviços Singleton no container.
   * @param {string} name 
   * @param {import('./container.js').ServiceRegistration} service 
   * @param {string[]} path 
   * @returns {any}
   */
  #resolveSingleton(name, service, path) {
    let instance = this.#container.getSingleton(name);
    if (instance) return instance;

    instance = this.#create(service, path);
    this.#container.setSingleton(name, instance);

    return instance;
  }

  /**
   * Resolve e cacheia serviços Scoped no escopo ativo.
   * @param {string} name 
   * @param {import('./container.js').ServiceRegistration} service 
   * @param {string[]} path 
   * @returns {any}
   * @throws {Error} Se não houver um escopo ativo.
   */
  #resolveScoped(name, service, path) {
    if (!this.#scope) {
      throw new Error(`Scoped service "${name}" requires a scope.`);
    }
    
    if (this.#scope.has(name)) {
      return this.#scope.get(name);
    }

    const instance = this.#create(service, path);
    this.#scope.set(name, instance);

    return instance;
  }

  /**
   * Cria uma nova instância resolvendo suas dependências recursivamente.
   * @param {import('./container.js').ServiceRegistration} service 
   * @param {string[]} path 
   * @returns {any}
   */
  #create(service, path) {
    const dependencies = service.dependencies.map(dep =>
      this.#resolve(dep, path)
    );
    return this.#instantiate(service.definition, dependencies);
  }

  /**
   * Instancia a definição (Classe ou Factory) com as dependências resolvidas.
   * @param {import('./container.js').ServiceDefinition} definition 
   * @param {any[]} dependencies 
   * @returns {any}
   */
  #instantiate(definition, dependencies) {
    // Heurística para diferenciar Classes de Factory Functions
    const source = Function.prototype.toString.call(definition);
    const isClass = /^class\s/.test(source) || (
      definition.prototype &&
      Object.getOwnPropertyNames(definition.prototype).length > 1
    );

    if (isClass) {
      return new definition(...dependencies);
    }

    return definition(...dependencies);
  }
}