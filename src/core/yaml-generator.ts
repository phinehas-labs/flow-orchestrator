import * as yaml from 'js-yaml';
import { MetadataExtractor } from './metadata-extractor';

export class YamlGenerator {
  private readonly metadataExtractor: MetadataExtractor;

  constructor(metadataExtractor: MetadataExtractor) {
    this.metadataExtractor = metadataExtractor;
  }

  generateYaml(flowName: string, baseUrl?: string): string {
    const steps = this.metadataExtractor.getSteps();
    
    const formattedSteps = steps.map(step => {
      const stepYamlObj: any = {
        id: step.id,
        path: step.path,
        method: step.method,
      };

      if (step.request) {
        stepYamlObj.request = {};
        if (step.request.body !== undefined) {
          stepYamlObj.request.body = step.request.body;
        }
        if (step.request.bodyTypes !== undefined && Object.keys(step.request.bodyTypes).length > 0) {
          stepYamlObj.request.bodyTypes = step.request.bodyTypes;
        }
        if (step.request.queryParams !== undefined) {
          stepYamlObj.request.queryParams = step.request.queryParams;
        }
      }

      if (step.dependencies && step.dependencies.length > 0) {
        stepYamlObj.dependsOn = step.dependencies.map(dep => {
          const depObj: any = {
            endpointId: dep.endpointId,
          };
          
          if (dep.when) {
            depObj.when = dep.when;
          }
          
          if (dep.loop) {
            depObj.loop = {
              over: dep.loop.over,
              as: dep.loop.as,
              mode: dep.loop.mode || 'sequential',
              ...(dep.loop.concurrency ? { concurrency: dep.loop.concurrency } : {}),
            };
          }
          
          depObj.inject = dep.inject.map(rule => {
            const ruleObj: any = {
              select: rule.select,
              assignTo: rule.assignTo,
            };
            
            if (rule.strategy && rule.strategy !== 'all') {
              ruleObj.strategy = rule.strategy;
            }
            
            if (rule.pick && rule.pick.length > 0) {
              ruleObj.pick = rule.pick;
            }
            
            if (rule.transform) {
              if (typeof rule.transform === 'function') {
                ruleObj.transform = 'custom:anonymous_function';
              } else {
                ruleObj.transform = rule.transform;
              }
            }
            
            return ruleObj;
          });
          
          return depObj;
        });
      }

      if (step.store && step.store.length > 0) {
        stepYamlObj.store = step.store.map(rule => {
          const storeObj: any = {
            select: rule.select,
            as: rule.as,
          };
          if (rule.transform) {
            if (typeof rule.transform === 'function') {
              storeObj.transform = 'custom:anonymous_function';
            } else {
              storeObj.transform = rule.transform;
            }
          }
          return storeObj;
        });
      }

      return stepYamlObj;
    });

    const flowObj = {
      version: '1.0',
      flowName,
      env: {
        baseUrl: this.getBaseUrlWithPrefix(baseUrl),
      },
      steps: formattedSteps,
    };

    return yaml.dump(flowObj, {
      lineWidth: -1,
      noRefs: true,
    });
  }

  private getBaseUrlWithPrefix(baseUrl?: string): string {
    const rawUrl = baseUrl || (typeof process !== 'undefined' ? process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}` : 'http://localhost:3000');
    if (rawUrl.endsWith('/api/v1') || rawUrl.endsWith('api/v1')) {
      return rawUrl;
    }
    const separator = rawUrl.endsWith('/') ? '' : '/';
    return `${rawUrl}${separator}api/v1`;
  }
}
