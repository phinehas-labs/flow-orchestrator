import { StepMetadata } from '../types/step.interface';
import { Logger } from './mapping-engine';

export class MetadataExtractor {
  private steps: Map<string, StepMetadata> = new Map();
  protected readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || console;
  }

  addStep(step: StepMetadata) {
    this.steps.set(step.id, step);
    this.detectCircularDependencies();
  }

  getSteps(): StepMetadata[] {
    return Array.from(this.steps.values());
  }

  getStep(id: string): StepMetadata | undefined {
    return this.steps.get(id);
  }

  protected detectCircularDependencies() {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (nodeId: string) => {
      if (recStack.has(nodeId)) {
        throw new Error(`Circular dependency detected in orchestrator flow: Loop involving step "${nodeId}"`);
      }
      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recStack.add(nodeId);

      const node = this.steps.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          checkCycle(dep.endpointId);
        }
      }

      recStack.delete(nodeId);
    };

    for (const stepId of this.steps.keys()) {
      checkCycle(stepId);
    }
  }
}
