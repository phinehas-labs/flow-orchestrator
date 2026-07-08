import { DependencyConfig, StoreConfig } from './dependency.interface';

export interface StepMetadata {
  /**
   * Unique ID identifying this flow step.
   */
  id: string;

  /**
   * Route Path (e.g., '/users/:id').
   */
  path: string;

  /**
   * HTTP Method (GET, POST, etc.).
   */
  method: string;

  /**
   * Controller class name.
   */
  controller: string;

  /**
   * Controller method name.
   */
  handlerName: string;

  /**
   * List of declared dependencies.
   */
  dependencies: DependencyConfig[];

  /**
   * List of environment variables to store from the response.
   */
  store?: StoreConfig[];

  /**
   * Request properties containing defaults and types for body/query.
   */
  request?: {
    body?: any;
    bodyTypes?: Record<string, string>;
    queryParams?: Record<string, any>;
  };
}
