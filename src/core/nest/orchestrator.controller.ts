import { Controller, Get, Response, Inject, Optional } from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { YamlGenerator } from '../yaml-generator';

@Controller('api-flow')
export class OrchestratorController {
  constructor(
    private readonly yamlGenerator: YamlGenerator,
    @Optional() @Inject('ORCHESTRATOR_MODULE_OPTIONS') private readonly options?: any
  ) {}

  @Get()
  getFlow(@Response() res: ExpressResponse) {
    const flowName = this.options?.flowName || 'StockBillFlow';
    const yamlContent = this.yamlGenerator.generateYaml(flowName, this.options?.baseUrl);
    res.setHeader('Content-Type', 'text/yaml');
    return res.send(yamlContent);
  }
}
