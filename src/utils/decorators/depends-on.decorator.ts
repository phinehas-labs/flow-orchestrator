import 'reflect-metadata';
import { DependencyConfig } from '../../types/dependency.interface';

export const DEPENDS_ON_METADATA_KEY = 'orchestrator:depends_on';

export function DependsOn(config: DependencyConfig | DependencyConfig[]) {
  const configs = Array.isArray(config) ? config : [config];
  return (target: object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<any>) => {
    if (descriptor) {
      Reflect.defineMetadata(DEPENDS_ON_METADATA_KEY, configs, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(DEPENDS_ON_METADATA_KEY, configs, target);
    return target;
  };
}
