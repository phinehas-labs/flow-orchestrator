import { FlowExecutor, ExecutionContextState } from './flow-executor';
import { YamlGenerator } from './yaml-generator';
import { MetadataExtractor } from './metadata-extractor';
import { MappingEngine, Logger } from './mapping-engine';

export interface OrchestratorOptions {
  baseUrl?: string;
  logger?: Logger;
  mappingEngine?: MappingEngine;
  metadataExtractor?: MetadataExtractor;
  flowExecutor?: FlowExecutor;
  yamlGenerator?: YamlGenerator;
}

export class Orchestrator {
  private readonly baseUrl?: string;
  private readonly logger: Logger;
  private readonly mappingEngine: MappingEngine;
  private readonly metadataExtractor: MetadataExtractor;
  private readonly flowExecutor: FlowExecutor;
  private readonly yamlGenerator: YamlGenerator;

  constructor(options: OrchestratorOptions = {}) {
    this.baseUrl = options.baseUrl;
    this.logger = options.logger || console;
    this.mappingEngine = options.mappingEngine || new MappingEngine(this.logger);
    this.metadataExtractor = options.metadataExtractor || new MetadataExtractor(this.logger);
    this.flowExecutor = options.flowExecutor || new FlowExecutor(this.mappingEngine, this.logger);
    this.yamlGenerator = options.yamlGenerator || new YamlGenerator(this.metadataExtractor);
  }

  getMappingEngine(): MappingEngine {
    return this.mappingEngine;
  }

  getMetadataExtractor(): MetadataExtractor {
    return this.metadataExtractor;
  }

  getFlowExecutor(): FlowExecutor {
    return this.flowExecutor;
  }

  getYamlGenerator(): YamlGenerator {
    return this.yamlGenerator;
  }

  generateYaml(flowName: string, baseUrl?: string): string {
    return this.yamlGenerator.generateYaml(flowName, baseUrl || this.baseUrl);
  }

  async executeFlow(flowYamlContent: any, baseUrl?: string): Promise<ExecutionContextState> {
    return this.flowExecutor.executeFlow(flowYamlContent, baseUrl || this.baseUrl);
  }
}
