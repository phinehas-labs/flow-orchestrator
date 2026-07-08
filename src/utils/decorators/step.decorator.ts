import 'reflect-metadata';

export const STEP_METADATA_KEY = 'orchestrator:step';

export interface StepOptions {
  description?: string;
}

export function Step(id: string, options?: StepOptions) {
  return (target: object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<any>) => {
    if (descriptor) {
      Reflect.defineMetadata(STEP_METADATA_KEY, { id, ...options }, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(STEP_METADATA_KEY, { id, ...options }, target);
    return target;
  };
}
