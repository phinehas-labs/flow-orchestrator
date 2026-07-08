import { Module, DynamicModule, Global, OnApplicationBootstrap, Inject, Optional } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { NestMetadataExtractor } from './nest-metadata-extractor';
import { MappingEngine } from '../mapping-engine';
import { YamlGenerator } from '../yaml-generator';
import { FlowExecutor } from '../flow-executor';
import { OrchestratorController } from './orchestrator.controller';
import { Orchestrator } from '../orchestrator';

// Backward compatible aliases
import { NestMetadataExtractor as MetadataExtractorService } from './nest-metadata-extractor';
import { MappingEngine as MappingEngineService } from '../mapping-engine';
import { YamlGenerator as YamlGeneratorService } from '../yaml-generator';
import { FlowExecutor as FlowExecutorService } from '../flow-executor';

export interface OrchestratorModuleOptions {
  flowName?: string;
  outputPath?: string;
  baseUrl?: string;
  isGlobal?: boolean;
}

@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [OrchestratorController],
  providers: [
    {
      provide: MappingEngine,
      useFactory: () => new MappingEngine(),
    },
    {
      provide: NestMetadataExtractor,
      useClass: NestMetadataExtractor,
    },
    {
      provide: YamlGenerator,
      useFactory: (extractor: NestMetadataExtractor) => new YamlGenerator(extractor),
      inject: [NestMetadataExtractor],
    },
    {
      provide: FlowExecutor,
      useFactory: (engine: MappingEngine) => new FlowExecutor(engine),
      inject: [MappingEngine],
    },
    {
      provide: Orchestrator,
      useFactory: (
        engine: MappingEngine,
        extractor: NestMetadataExtractor,
        executor: FlowExecutor,
        generator: YamlGenerator,
        options?: OrchestratorModuleOptions
      ) => {
        return new Orchestrator({
          baseUrl: options?.baseUrl,
          mappingEngine: engine,
          metadataExtractor: extractor,
          flowExecutor: executor,
          yamlGenerator: generator,
        });
      },
      inject: [
        MappingEngine,
        NestMetadataExtractor,
        FlowExecutor,
        YamlGenerator,
        { token: 'ORCHESTRATOR_MODULE_OPTIONS', optional: true },
      ],
    },
  ],
  exports: [
    MappingEngine,
    NestMetadataExtractor,
    YamlGenerator,
    FlowExecutor,
    Orchestrator,
  ],
})
export class OrchestratorModule implements OnApplicationBootstrap {
  constructor(
    private readonly yamlGenerator: YamlGenerator,
    @Optional() @Inject('ORCHESTRATOR_MODULE_OPTIONS') private readonly options?: OrchestratorModuleOptions
  ) {}

  onApplicationBootstrap() {
    try {
      const flowName = this.options?.flowName || 'StockBillFlow';
      const outputPath = this.options?.outputPath || path.join(process.cwd(), 'api-flow.yaml');
      const yamlContent = this.yamlGenerator.generateYaml(flowName, this.options?.baseUrl);
      
      fs.writeFileSync(outputPath, yamlContent, 'utf8');
      console.log(`[Orchestrator] Successfully generated and wrote API flow definition to: ${outputPath}`);
    } catch (err) {
      console.error('[Orchestrator] Failed to auto-generate API flow YAML file on startup:', err);
    }
  }

  static forRoot(options: OrchestratorModuleOptions = {}): DynamicModule {
    return {
      module: OrchestratorModule,
      global: options.isGlobal !== false,
      providers: [
        {
          provide: 'ORCHESTRATOR_MODULE_OPTIONS',
          useValue: options,
        },
      ],
    };
  }
}
export { MetadataExtractorService, MappingEngineService, YamlGeneratorService, FlowExecutorService };
