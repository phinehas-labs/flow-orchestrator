import * as lodash from 'lodash';
import { SelectionStrategy } from '../utils/strategies/selection/selection.strategy';
import { TransformerStrategy } from '../utils/strategies/transformation/transformer.strategy';
import { FirstSelectionStrategy } from '../utils/strategies/selection/first-selection.strategy';
import { LastSelectionStrategy } from '../utils/strategies/selection/last-selection.strategy';
import { RandomSelectionStrategy } from '../utils/strategies/selection/random-selection.strategy';
import { AllSelectionStrategy } from '../utils/strategies/selection/all-selection.strategy';
import { TransformationType } from '../types/dependency.interface';
import {
  StringTransformer,
  NumberTransformer,
  BooleanTransformer,
  DateTransformer,
  BearerTransformer,
} from '../utils/strategies/transformation/default-transformers';

export interface Logger {
  log(message: string, ...optionalParams: any[]): any;
  error(message: string, ...optionalParams: any[]): any;
  warn(message: string, ...optionalParams: any[]): any;
  debug?(message: string, ...optionalParams: any[]): any;
}

export class MappingEngine {
  private readonly logger: Logger;
  private selectionStrategies = new Map<string, SelectionStrategy>();
  private transformers = new Map<string, TransformerStrategy>();

  constructor(logger?: Logger) {
    this.logger = logger || console;

    // Register Default Selection Strategies
    this.registerSelectionStrategy('first', new FirstSelectionStrategy());
    this.registerSelectionStrategy('last', new LastSelectionStrategy());
    this.registerSelectionStrategy('random', new RandomSelectionStrategy());
    this.registerSelectionStrategy('all', new AllSelectionStrategy());

    // Register Default Transformers
    this.registerTransformer('string', new StringTransformer());
    this.registerTransformer('number', new NumberTransformer());
    this.registerTransformer('boolean', new BooleanTransformer());
    this.registerTransformer('date', new DateTransformer());
    this.registerTransformer('bearer', new BearerTransformer());
  }

  registerSelectionStrategy(name: string, strategy: SelectionStrategy) {
    this.selectionStrategies.set(name, strategy);
  }

  registerTransformer(name: string, transformer: TransformerStrategy) {
    this.transformers.set(name, transformer);
  }

  extractValue(sourceData: any, selectPath: string, pickFields?: string[], strategy = 'all', transform?: TransformationType): any {
    // 1. Select value using path (lodash-style resolution)
    let value = lodash.get(sourceData, selectPath);

    if (value === undefined || value === null) {
      return null;
    }

    // 2. Apply Selection Strategy if value is array
    if (Array.isArray(value)) {
      const selectionStrategy = this.selectionStrategies.get(strategy) || this.selectionStrategies.get('all')!;
      value = selectionStrategy.select(value);
    }

    // 3. Apply Pick filter
    if (pickFields && pickFields.length > 0) {
      if (Array.isArray(value)) {
        value = value.map(item => lodash.pick(item, pickFields));
      } else if (typeof value === 'object') {
        value = lodash.pick(value, pickFields);
      }
    }

    // 4. Apply Transformation Strategy / Function
    if (transform) {
      if (typeof transform === 'function') {
        value = Array.isArray(value) ? value.map(item => transform(item)) : transform(value);
      } else {
        const transformer = this.transformers.get(transform);
        if (transformer) {
          value = Array.isArray(value) ? value.map(item => transformer.transform(item)) : transformer.transform(value);
        } else {
          this.logger.warn(`Transformer with token name "${transform}" is not registered. Returning original value.`);
        }
      }
    }

    return value;
  }
}
