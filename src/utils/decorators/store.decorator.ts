import 'reflect-metadata';
import { StoreConfig } from '../../types/dependency.interface';

export const STORE_METADATA_KEY = 'orchestrator:store';

export function Store(config: StoreConfig | StoreConfig[]) {
  const configs = Array.isArray(config) ? config : [config];
  return (target: object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<any>) => {
    if (descriptor) {
      Reflect.defineMetadata(STORE_METADATA_KEY, configs, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(STORE_METADATA_KEY, configs, target);
    return target;
  };
}
