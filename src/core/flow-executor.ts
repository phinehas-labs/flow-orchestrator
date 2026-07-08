import axios from 'axios';
import * as lodash from 'lodash';
import { MappingEngine, Logger } from './mapping-engine';

export interface StepResult {
  status: number;
  headers: any;
  body: any;
}

export interface ExecutionContextState {
  steps: Record<string, StepResult>;
  env?: Record<string, any>;
  variables?: Record<string, any>;
}

export class FlowExecutor {
  private readonly logger: Logger;
  private readonly mappingEngine: MappingEngine;

  constructor(mappingEngine: MappingEngine, logger?: Logger) {
    this.mappingEngine = mappingEngine;
    this.logger = logger || console;
  }

  async executeFlow(flowYamlContent: any, baseUrl = 'http://localhost:3000'): Promise<ExecutionContextState> {
    const state: ExecutionContextState = { steps: {}, env: {}, variables: {} };
    const steps = flowYamlContent.steps;

    if (!steps || !Array.isArray(steps)) {
      throw new Error('Invalid flow YAML format: "steps" array is required.');
    }

    // 1. Sort steps topologically based on declared dependency nodes
    const sortedSteps = this.topologicalSort(steps);

    for (const step of sortedSteps) {
      // 2. Evaluate executing conditions ('when')
      if (step.dependsOn) {
        let shouldExecute = true;
        for (const dep of step.dependsOn) {
          if (dep.when && !this.evaluateCondition(dep.when, state)) {
            shouldExecute = false;
            break;
          }
        }
        if (!shouldExecute) {
          this.logger.log(`Skipping step "${step.id}" due to execution condition mismatch.`);
          continue;
        }
      }

      // 3. Inject Values from dependencies into request context
      const requestPayload = {
        body: step.request?.body ? lodash.cloneDeep(step.request.body) : {},
        query: step.request?.queryParams ? lodash.cloneDeep(step.request.queryParams) : {},
        params: {},
        headers: {}
      };
      
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          const depResult = state.steps[dep.endpointId];
          if (!depResult) continue;

          if (dep.loop) {
            // Loop Mode Processing
            const arrayToLoop = lodash.get(depResult, dep.loop.over);
            const loopItems = Array.isArray(arrayToLoop) ? arrayToLoop : (arrayToLoop ? [arrayToLoop] : []);

            const loopAccumulators: Record<string, any[]> = {};

            for (const item of loopItems) {
              const scope = { [dep.loop.as]: item };
              
              for (const rule of dep.inject) {
                const prefix = `${dep.loop.as}.`;
                let selectPath = rule.select;
                let targetData = scope;
                
                if (rule.select.startsWith(prefix)) {
                  selectPath = rule.select.substring(prefix.length);
                  targetData = item;
                }

                const value = this.mappingEngine.extractValue(
                  targetData,
                  selectPath,
                  rule.pick,
                  rule.strategy || 'all',
                  rule.transform
                );

                if (!loopAccumulators[rule.assignTo]) {
                  loopAccumulators[rule.assignTo] = [];
                }
                loopAccumulators[rule.assignTo].push(value);
              }
            }

            // Assign accumulated arrays to target fields
            for (const [assignTo, values] of Object.entries(loopAccumulators)) {
              lodash.set(requestPayload, assignTo, values);
            }
          } else if (dep.inject) {
            // Standard Single Dependency Injection
            for (const rule of dep.inject) {
              const value = this.mappingEngine.extractValue(
                depResult,
                rule.select,
                rule.pick,
                rule.strategy || 'all',
                rule.transform
              );
              lodash.set(requestPayload, rule.assignTo, value);
            }
          }
        }
      }

      // Interpolate template parameters from context env/variables/steps
      requestPayload.body = this.interpolatePayload(requestPayload.body, state);
      requestPayload.query = this.interpolatePayload(requestPayload.query, state);
      requestPayload.headers = this.interpolatePayload(requestPayload.headers, state);
      requestPayload.params = this.interpolatePayload(requestPayload.params, state);

      // 4. Dispatch Dynamic HTTP Request
      const response = await this.dispatchRequest(baseUrl, step.path, step.method, requestPayload);
      state.steps[step.id] = response;
      this.logger.log(`Step "${step.id}" executed successfully with status ${response.status}.`);

      // 5. Store response properties in env/variables if configured
      if (step.store && Array.isArray(step.store)) {
        for (const rule of step.store) {
          const value = this.mappingEngine.extractValue(
            response,
            rule.select,
            undefined,
            'all',
            rule.transform
          );
          lodash.set(state, rule.as, value);
          this.logger.log(`Stored value in state path: "${rule.as}"`);
        }
      }
    }

    return state;
  }

  private interpolatePayload(payload: any, state: ExecutionContextState): any {
    if (typeof payload === 'string') {
      return this.interpolateString(payload, state);
    }
    if (Array.isArray(payload)) {
      return payload.map(item => this.interpolatePayload(item, state));
    }
    if (typeof payload === 'object' && payload !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(payload)) {
        result[key] = this.interpolatePayload(value, state);
      }
      return result;
    }
    return payload;
  }

  private interpolateString(template: string, state: ExecutionContextState): string {
    if (!template) return '';
    const variableRegex = /\{\{([^}]+)\}\}/g;
    
    return template.replace(variableRegex, (match, expression) => {
      const trimmedPath = expression.trim();
      const val = lodash.get(state, trimmedPath);
      if (val !== undefined && val !== null) {
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      }
      return match;
    });
  }

  private evaluateCondition(expression: string, state: ExecutionContextState): boolean {
    try {
      const conditions = expression.split('&&').map(c => c.trim());
      
      for (const cond of conditions) {
        const opMatch = cond.match(/(===|!==|==|!=|>=|<=|>|<)/);
        if (!opMatch) {
          const val = lodash.get(state, cond);
          if (!val) return false;
          continue;
        }

        const op = opMatch[0];
        const parts = cond.split(op).map(p => p.trim());
        if (parts.length !== 2) return false;

        const leftPath = parts[0];
        let rightValStr = parts[1];

        const leftVal = lodash.get(state, leftPath);
        let rightVal: any = rightValStr;

        if (rightValStr === 'true') {
          rightVal = true;
        } else if (rightValStr === 'false') {
          rightVal = false;
        } else if (rightValStr === 'null') {
          rightVal = null;
        } else if (!isNaN(Number(rightValStr))) {
          rightVal = Number(rightValStr);
        } else if ((rightValStr.startsWith("'") && rightValStr.endsWith("'")) || (rightValStr.startsWith('"') && rightValStr.endsWith('"'))) {
          rightVal = rightValStr.substring(1, rightValStr.length - 1);
        }

        let conditionPassed = false;
        switch (op) {
          case '===':
          case '==':
            conditionPassed = (leftVal === rightVal);
            break;
          case '!==':
          case '!=':
            conditionPassed = (leftVal !== rightVal);
            break;
          case '>':
            conditionPassed = (leftVal > rightVal);
            break;
          case '<':
            conditionPassed = (leftVal < rightVal);
            break;
          case '>=':
            conditionPassed = (leftVal >= rightVal);
            break;
          case '<=':
            conditionPassed = (leftVal <= rightVal);
            break;
        }

        if (!conditionPassed) {
          return false;
        }
      }

      return true;
    } catch (err) {
      this.logger.error(`Error evaluating condition "${expression}":`, err);
      return false;
    }
  }

  private async dispatchRequest(baseUrl: string, path: string, method: string, payload: any): Promise<StepResult> {
    let urlPath = path;
    const params = payload.params || {};
    for (const [key, value] of Object.entries(params)) {
      urlPath = urlPath.replace(`:${key}`, String(value));
    }

    const url = `${baseUrl}${urlPath}`;

    try {
      const response = await axios({
        url,
        method: method as any,
        data: payload.body,
        params: payload.query,
        headers: {
          'Content-Type': 'application/json',
          ...payload.headers,
        },
      });

      return {
        status: response.status,
        headers: response.headers,
        body: response.data,
      };
    } catch (err: any) {
      if (err.response) {
        return {
          status: err.response.status,
          headers: err.response.headers,
          body: err.response.data,
        };
      }
      throw err;
    }
  }

  private topologicalSort(steps: any[]): any[] {
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const stepMap = new Map<string, any>();

    for (const step of steps) {
      stepMap.set(step.id, step);
      adjList.set(step.id, []);
      inDegree.set(step.id, 0);
    }

    for (const step of steps) {
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (stepMap.has(dep.endpointId)) {
            adjList.get(dep.endpointId)!.push(step.id);
            inDegree.set(step.id, inDegree.get(step.id)! + 1);
          }
        }
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const sorted: any[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      const step = stepMap.get(u);
      if (step) {
        sorted.push(step);
      }

      const neighbors = adjList.get(u) || [];
      for (const v of neighbors) {
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    if (sorted.length !== steps.length) {
      throw new Error('Circular dependency detected in execution flow topological sort!');
    }

    return sorted;
  }
}
