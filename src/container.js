/**
 * A simple dependency injection container for JavaScript.
 * 
 * Based on: https://dev.to/emanuelgustafzon/build-your-own-di-container-in-javascript-2da3
 */
export default class Container {
  static SCOPES = Object.freeze({
    TRANSIENT: 'transient',
    SINGLETON: 'singleton',
    SCOPED: 'scoped'
  });

  #services = new Map();
  #scopedServices = new Map();

  /**
   * Registers a service with the container.
   * @param {string} name - The name of the service to register
   * @param {Function} definition - The class or factory function that defines the service
   * @param {'transient'|'singleton'|'scoped'} scope - The scope of the service ('transient', 'singleton', or 'scoped')
   * @param {string[]} dependencies - An array of service names that this service depends on
   */
  register(name, definition, scope, dependencies = []) {
    if (!name || typeof name !== 'string') {
      throw new Error('Service name must be a non-empty string.');
    }

    if (typeof definition !== 'function') {
      throw new Error(`Service "${name}" definition must be a function or class.`);
    }

    if (!Object.values(Container.SCOPES).includes(scope)) {
      throw new Error(
        `Invalid scope "${scope}". Valid scopes are: ${Object.values(Container.SCOPES).join(', ')}.`
      );
    }

    if (!Array.isArray(dependencies)) {
      throw new Error(`Dependencies for "${name}" must be an array.`);
    }

    this.#services.set(name, {
      definition,
      scope,
      dependencies,
      instance: null
    });
  }

  /**
   * Resolves a service by its name, creating a new instance if necessary based on its scope.
   * @param {string} name - The name of the service to resolve
   * @param {*} context - The context for scoped services
   * @returns {*} - The resolved service instance
   */
  resolve(name, context = null) {
    return this.#resolve(name, context, []);
  }

  /**
   * Internal resolver with circular dependency tracking.
   * 
   * @param {string} name - The name of the service to resolve
   * @param {*} context - The context for scoped services
   * @param {Array} resolutionPath - The current resolution path for circular dependency detection
   *
   * @private
   */
  #resolve(name, context, resolutionPath) {
    const service = this.#services.get(name);

    if (!service) {
      throw new Error(`Service "${name}" not found.`);
    }

    // Check for circular dependencies
    if (resolutionPath.includes(name)) {
      const cycle = [...resolutionPath, name].join(' -> ');

      throw new Error(
        `Circular dependency detected: ${cycle}`
      );
    }

    const currentPath = [...resolutionPath, name];

    switch (service.scope) {
      case Container.SCOPES.TRANSIENT:
        return this.#createInstance(service, context, currentPath);

      case Container.SCOPES.SINGLETON:
        if (!service.instance) {
          service.instance = this.#createInstance(
            service,
            context,
            currentPath
          );
        }

        return service.instance;

      case Container.SCOPES.SCOPED:
        return this.#resolveScoped(
          name,
          service,
          context,
          currentPath
        );

      default:
        throw new Error(`Unsupported scope "${service.scope}".`);
    }
  }

  /**
   * Resolves a scoped service.
   * 
   * @param {string} name - The name of the service to resolve
   * @param {Object} service - The service definition object
   * @param {*} context - The context for the scoped service
   * @param {Array} resolutionPath - The current resolution path for circular dependency detection
   *
   * @private
   */
  #resolveScoped(name, service, context, resolutionPath) {
    if (!context) {
      throw new Error(
        `Scoped service "${name}" requires a context.`
      );
    }

    if (!this.#scopedServices.has(context)) {
      this.#scopedServices.set(context, new Map());
    }

    const contextServices = this.#scopedServices.get(context);

    if (!contextServices.has(name)) {
      const instance = this.#createInstance(
        service,
        context,
        resolutionPath
      );

      contextServices.set(name, instance);
    }

    return contextServices.get(name);
  }

  /**
   * Creates a service instance.
   * 
   * @param {Object} service - The service definition object
   * @param {*} context - The context for scoped services
   * @param {Array} resolutionPath - The current resolution path for circular dependency detection
   *
   * Supports:
   * - ES Classes
   * - Factory functions
   *
   * @private
   */
  #createInstance(service, context, resolutionPath) {
    // Resolve dependencies recursively
    const dependencies = service.dependencies.map(dependency =>
      this.#resolve(dependency, context, resolutionPath)
    );

    return this.#instantiate(service.definition, dependencies);
  }

  /**
   * Instantiates a class or invokes a factory function.
   * 
   * @param {Function} definition - The class or factory function to instantiate
   * @param {Array} dependencies - The resolved dependencies to pass to the constructor or factory function
   *
   * @private
   */
  #instantiate(definition, dependencies) {
    const source = Function.prototype.toString.call(definition);

    const isClass =
      /^class\s/.test(source) ||
      (definition.prototype &&
        Object.getOwnPropertyNames(definition.prototype).length > 1);

    if (isClass) {
      return new definition(...dependencies);
    }

    return definition(...dependencies);
  }

  /**
   * Clears all services associated with a given context.
   * @param {*} context - The context for which to clear services
   */
  clearContext(context) {
    this.#scopedServices.delete(context);
  }
}