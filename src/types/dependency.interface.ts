export type SelectionStrategyType = 'first' | 'last' | 'random' | 'all' | string;
export type TransformerFunction = (value: any) => any;
export type TransformationType = 'string' | 'number' | 'boolean' | 'date' | string | TransformerFunction;

export interface LoopConfig {
  /**
   * JSONPath or dot-notation path to the array to loop over in the source step response.
   * e.g. "body.banks"
   */
  over: string;
  
  /**
   * The variable alias representing the current item during iteration (e.g., "bank").
   */
  as: string;
  
  /**
   * Parallel execution or sequential execution.
   */
  mode?: 'parallel' | 'sequential';
  
  /**
   * Maximum concurrency when mode is 'parallel'.
   */
  concurrency?: number;
}

export interface InjectionRule {
  /**
   * Dot-notation or JSONPath to extract value from source step response.
   * Supports referencing loop variables (e.g. "bank.code").
   */
  select: string;

  /**
   * Specific fields to pick if the extracted value is an object or array of objects.
   */
  pick?: string[];

  /**
   * Strategy applied if the extracted value is an array.
   */
  strategy?: SelectionStrategyType;

  /**
   * Target path in the current request to inject the value.
   * Prefixed by target type: 'body.userId', 'params.id', 'headers.Authorization', 'query.limit'.
   */
  assignTo: string;

  /**
   * Built-in/custom transformation token name or an inline transformer function.
   */
  transform?: TransformationType;
}

export interface DependencyConfig {
  /**
   * Unique ID of the step/endpoint this endpoint depends on.
   */
  endpointId: string;

  /**
   * Optional boolean expression representing when this dependency applies.
   * e.g., "steps.create_user.response.body.active === true"
   */
  when?: string;

  /**
   * Set of rules for extracting and injecting data from this dependency.
   */
  inject: InjectionRule[];

  /**
   * Loop configuration if looping over dependency responses.
   */
  loop?: LoopConfig;
}

export interface StoreConfig {
  /**
   * Dot-notation path to extract value from current step's response.
   */
  select: string;

  /**
   * Target environment variable name to store the value under (e.g. "env.AUTH_TOKEN").
   */
  as: string;

  /**
   * Optional transformation strategy or custom function.
   */
  transform?: TransformationType;
}
