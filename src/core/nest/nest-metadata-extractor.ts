import { Injectable, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { MetadataExtractor } from '../metadata-extractor';
import { STEP_METADATA_KEY } from '../../utils/decorators/step.decorator';
import { DEPENDS_ON_METADATA_KEY } from '../../utils/decorators/depends-on.decorator';
import { STORE_METADATA_KEY } from '../../utils/decorators/store.decorator';
import { StepMetadata, DependencyConfig, StoreConfig } from '../../types';
import { Logger } from '../mapping-engine';

@Injectable()
export class NestMetadataExtractor extends MetadataExtractor implements OnModuleInit {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    @Optional() @Inject('ORCHESTRATOR_LOGGER') logger?: Logger
  ) {
    super(logger);
  }

  onModuleInit() {
    try {
      this.extractMetadata();
      this.detectCircularDependencies();
      this.logger.log(`Orchestrator successfully loaded ${this.getSteps().length} flow steps.`);
    } catch (err) {
      this.logger.error('Failed to initialize API Orchestrator Metadata:', err);
      throw err;
    }
  }

  private extractMetadata() {
    const controllers = this.discoveryService.getControllers();

    for (const wrapper of controllers) {
      const { instance } = wrapper;
      if (!instance) continue;

      const prototype = Object.getPrototypeOf(instance);
      const controllerClass = prototype.constructor;
      
      // Resolve path prefix from @Controller decorator
      const controllerPrefix = this.reflector.get('path', controllerClass) || '';
      
      const methodNames = this.metadataScanner.getAllMethodNames(prototype);

      for (const methodName of methodNames) {
        const target = prototype[methodName];
        const stepMeta = this.reflector.get(STEP_METADATA_KEY, target);
        
        if (stepMeta) {
          const dependencies: DependencyConfig[] = this.reflector.get(
            DEPENDS_ON_METADATA_KEY,
            target,
          ) || [];

          const store: StoreConfig[] = this.reflector.get(
            STORE_METADATA_KEY,
            target,
          ) || [];

          // Retrieve method-level route metadata from standard NestJS HTTP decorators
          const routePath = this.reflector.get('path', target) || '';
          const fullPath = this.joinPaths(controllerPrefix, routePath);

          const methodCode = this.reflector.get('method', target);
          const methodMap = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
          const method = methodMap[methodCode] || 'GET';

          // Extract request body and query param DTOs
          const ROUTE_ARGS_METADATA = '__routeArguments__';
          const routeArgs = 
            Reflect.getMetadata(ROUTE_ARGS_METADATA, controllerClass, methodName) || 
            Reflect.getMetadata(ROUTE_ARGS_METADATA, controllerClass.prototype, methodName) || 
            {};
          
          const paramTypes = Reflect.getMetadata('design:paramtypes', controllerClass.prototype, methodName) || [];

          let body: any = undefined;
          let bodyTypes: Record<string, string> = {};
          let queryParams: Record<string, any> | undefined = undefined;

          for (const key of Object.keys(routeArgs)) {
            const arg = routeArgs[key];
            if (!arg) continue;

            let paramType: number | undefined = undefined;
            if (key.includes(':')) {
              const [pTypeStr] = key.split(':');
              paramType = parseInt(pTypeStr, 10);
            }

            if (paramType === 3) { // RouteParamtypes.BODY
              const index = arg.index;
              const hasData = arg.data;

              if (hasData) {
                if (!body) body = {};
                const pType = paramTypes[index];
                let typeStr = 'string';
                let defaultValue: any = '';
                if (pType === Number) { typeStr = 'number'; defaultValue = 0; }
                else if (pType === Boolean) { typeStr = 'boolean'; defaultValue = false; }
                body[hasData] = defaultValue;
                bodyTypes[hasData] = typeStr;
              } else {
                const bodyClass = paramTypes[index];
                const props = this.getPropertiesOfClass(bodyClass);
                if (props) {
                  body = props.body;
                  bodyTypes = props.bodyTypes;
                }
              }
            } else if (paramType === 4) { // RouteParamtypes.QUERY
              const index = arg.index;
              const hasData = arg.data;

              if (hasData) {
                if (!queryParams) queryParams = {};
                const pType = paramTypes[index];
                let defaultValue: any = '';
                if (pType === Number) { defaultValue = 0; }
                else if (pType === Boolean) { defaultValue = false; }
                queryParams[hasData] = defaultValue;
              } else {
                const queryClass = paramTypes[index];
                const props = this.getPropertiesOfClass(queryClass);
                if (props) {
                  queryParams = props.body;
                }
              }
            }
          }

          let request: StepMetadata['request'] = undefined;
          if (body !== undefined || queryParams !== undefined) {
            request = {};
            if (body !== undefined) {
              request.body = body;
              request.bodyTypes = bodyTypes;
            }
            if (queryParams !== undefined) {
              request.queryParams = queryParams;
            }
          }

          const metadata: StepMetadata = {
            id: stepMeta.id,
            path: fullPath,
            method,
            controller: controllerClass.name,
            handlerName: methodName,
            dependencies,
            store: store.length > 0 ? store : undefined,
            request,
          };

          this.addStep(metadata);
        }
      }
    }
  }

  private getPropertiesOfClass(cls: any): { body: any; bodyTypes: Record<string, string> } | null {
    if (!cls || typeof cls !== 'function' || !cls.prototype || cls === Object || cls === String || cls === Number || cls === Boolean) {
      return null;
    }
    const propertiesArray = Reflect.getMetadata('swagger/apiModelPropertiesArray', cls.prototype);
    if (!propertiesArray || !Array.isArray(propertiesArray)) {
      return null;
    }

    const body: Record<string, any> = {};
    const bodyTypes: Record<string, string> = {};

    for (const propertyName of propertiesArray) {
      const cleanName = propertyName.startsWith(':') ? propertyName.substring(1) : propertyName;
      const meta = Reflect.getMetadata('swagger/apiModelProperties', cls.prototype, cleanName);
      if (meta) {
        let typeStr = 'string';
        let defaultValue: any = '';

        let isArray = false;
        let typeVal = meta.type;

        if (Array.isArray(typeVal) && typeVal.length > 0) {
          isArray = true;
          typeVal = typeVal[0];
        } else if (meta.isArray) {
          isArray = true;
        }

        let resolvedType = typeVal;
        if (typeof typeVal === 'function') {
          if (!typeVal.prototype || typeVal.name === 'type' || typeVal.name === '') {
            try {
              const res = typeVal();
              if (res) {
                resolvedType = res;
              }
            } catch {}
          }
        }

        if (typeof resolvedType === 'function') {
          if (resolvedType === String) {
            typeStr = 'string';
            defaultValue = meta.example !== undefined ? meta.example : '';
          } else if (resolvedType === Number) {
            typeStr = 'number';
            defaultValue = meta.example !== undefined ? meta.example : 0;
          } else if (resolvedType === Boolean) {
            typeStr = 'boolean';
            defaultValue = meta.example !== undefined ? meta.example : false;
          } else if (resolvedType === Date) {
            typeStr = 'date';
            defaultValue = meta.example !== undefined ? meta.example : new Date().toISOString();
          } else {
            // Nested class DTO
            const nested = this.getPropertiesOfClass(resolvedType);
            if (nested) {
              if (isArray) {
                typeStr = 'array';
                body[cleanName] = [nested.body];
                bodyTypes[cleanName] = 'array';
                continue;
              } else {
                typeStr = 'object';
                body[cleanName] = nested.body;
                bodyTypes[cleanName] = 'object';
                continue;
              }
            } else {
              typeStr = resolvedType.name || 'object';
              defaultValue = {};
            }
          }
        } else if (typeof resolvedType === 'string') {
          typeStr = resolvedType.toLowerCase();
          if (typeStr === 'number') defaultValue = 0;
          else if (typeStr === 'boolean') defaultValue = false;
          else defaultValue = '';
        }

        if (isArray) {
          bodyTypes[cleanName] = 'array';
          body[cleanName] = meta.example !== undefined ? meta.example : [defaultValue];
        } else {
          bodyTypes[cleanName] = typeStr;
          body[cleanName] = meta.example !== undefined ? meta.example : defaultValue;
        }
      }
    }

    return { body, bodyTypes };
  }

  private joinPaths(prefix: string, path: string): string {
    const cleanPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const joined = `${cleanPrefix}${cleanPath}`.replace(/\/+/g, '/');
    return joined === '/' ? '/' : joined.replace(/\/$/, '');
  }
}
