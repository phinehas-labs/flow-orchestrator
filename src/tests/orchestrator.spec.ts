import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Step,
  DependsOn,
  Store,
  OrchestratorModule,
  NestMetadataExtractor,
  MappingEngine,
  YamlGenerator,
  FlowExecutor,
} from '../index';

// ----------------------------------------------------
// Mock DTOs for Testing
// ----------------------------------------------------
class CreateUserDto {
  @ApiProperty({ description: 'User name', example: 'Jane Doe' })
  name!: string;

  @ApiProperty({ description: 'User age', example: 25 })
  age!: number;
}

class ListBanksQuery {
  @ApiProperty({ description: 'Filter by bank name', required: false, example: 'Alpha' })
  filter?: string;
}

// ----------------------------------------------------
// Mock Controllers for Testing
// ----------------------------------------------------
@Controller('users')
class TestUsersController {
  @Post('create')
  @Step('create_user')
  @Store({ select: 'body.id', as: 'env.USER_ID', transform: 'string' })
  createUser(@Body() dto: CreateUserDto) {
    return { id: 123, name: dto.name, active: true };
  }
}

@Controller('banks')
class TestBanksController {
  @Get('list')
  @Step('list_banks')
  listBanks(@Query() query: ListBanksQuery) {
    return {
      banks: [
        { code: '001', name: 'Alpha Bank' },
        { code: '002', name: 'Beta Trust' }
      ]
    };
  }

  @Post('link')
  @Step('link_bank')
  @DependsOn([
    {
      endpointId: 'create_user',
      when: 'steps.create_user.body.active === true',
      inject: [
        { select: 'body.id', assignTo: 'body.userId', transform: 'string' }
      ]
    },
    {
      endpointId: 'list_banks',
      inject: [
        { select: 'body.banks', strategy: 'first', pick: ['code'], assignTo: 'body.bankCode' }
      ]
    }
  ])
  linkBank() {
    return { linked: true };
  }
}

@Controller('cyclic')
class CyclicAController {
  @Get('a')
  @Step('step_a')
  @DependsOn({ endpointId: 'step_b', inject: [] })
  getA() {}
}

@Controller('cyclic-b')
class CyclicBController {
  @Get('b')
  @Step('step_b')
  @DependsOn({ endpointId: 'step_a', inject: [] })
  getB() {}
}

describe('API Orchestrator Package', () => {
  let mappingEngine: MappingEngine;
  let metadataExtractor: NestMetadataExtractor;
  let yamlGenerator: YamlGenerator;
  let flowExecutor: FlowExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [OrchestratorModule],
      controllers: [TestUsersController, TestBanksController],
    }).compile();

    mappingEngine = module.get<MappingEngine>(MappingEngine);
    metadataExtractor = module.get<NestMetadataExtractor>(NestMetadataExtractor);
    yamlGenerator = module.get<YamlGenerator>(YamlGenerator);
    flowExecutor = module.get<FlowExecutor>(FlowExecutor);

    // Trigger metadata scanner manually for tests since NestJS app bootstrapping isn't fully run
    metadataExtractor.onModuleInit();
  });

  // 1. Metadata Extractor Tests
  describe('MetadataExtractor / NestMetadataExtractor', () => {
    it('should correctly scan controllers and compile step metadata', () => {
      const steps = metadataExtractor.getSteps();
      expect(steps.length).toBe(3);

      const createUserStep = metadataExtractor.getStep('create_user');
      expect(createUserStep).toBeDefined();
      expect(createUserStep!.path).toBe('/users/create');
      expect(createUserStep!.method).toBe('POST');
      expect(createUserStep!.store).toBeDefined();
      expect(createUserStep!.store![0].as).toBe('env.USER_ID');
      expect(createUserStep!.request).toBeDefined();
      expect(createUserStep!.request!.body).toEqual({ name: 'Jane Doe', age: 25 });
      expect(createUserStep!.request!.bodyTypes).toEqual({ name: 'string', age: 'number' });

      const listBanksStep = metadataExtractor.getStep('list_banks');
      expect(listBanksStep).toBeDefined();
      expect(listBanksStep!.request).toBeDefined();
      expect(listBanksStep!.request!.queryParams).toEqual({ filter: 'Alpha' });

      const linkBankStep = metadataExtractor.getStep('link_bank');
      expect(linkBankStep).toBeDefined();
      expect(linkBankStep!.dependencies.length).toBe(2);
      expect(linkBankStep!.dependencies[0].endpointId).toBe('create_user');
      expect(linkBankStep!.dependencies[0].when).toBe('steps.create_user.body.active === true');
    });

    it('should fail bootstrap when circular dependencies are present', async () => {
      const createModule = () =>
        Test.createTestingModule({
          imports: [OrchestratorModule],
          controllers: [CyclicAController, CyclicBController],
        }).compile();

      await expect(async () => {
        const module = await createModule();
        const extractor = module.get<NestMetadataExtractor>(NestMetadataExtractor);
        extractor.onModuleInit();
      }).rejects.toThrow('Circular dependency detected in orchestrator flow');
    });
  });

  // 2. Mapping Engine Tests
  describe('MappingEngine', () => {
    const mockResponse = {
      status: 'active',
      data: {
        userId: 'usr_5521',
        banks: [
          { code: '001', name: 'Alpha Bank' },
          { code: '002', name: 'Beta Trust' }
        ]
      }
    };

    it('should extract values using dot-notation select paths', () => {
      const userId = mappingEngine.extractValue(mockResponse, 'data.userId');
      expect(userId).toBe('usr_5521');
    });

    it('should apply array selection strategies (first, last, random, all)', () => {
      const firstBank = mappingEngine.extractValue(mockResponse, 'data.banks', undefined, 'first');
      expect(firstBank).toEqual({ code: '001', name: 'Alpha Bank' });

      const lastBank = mappingEngine.extractValue(mockResponse, 'data.banks', undefined, 'last');
      expect(lastBank).toEqual({ code: '002', name: 'Beta Trust' });
    });

    it('should apply pick filtering to objects', () => {
      const pickedBank = mappingEngine.extractValue(
        mockResponse,
        'data.banks',
        ['code'],
        'first'
      );
      expect(pickedBank).toEqual({ code: '001' });
    });

    it('should apply transformations', () => {
      const numValue = mappingEngine.extractValue({ value: '123' }, 'value', undefined, 'all', 'number');
      expect(numValue).toBe(123);

      const boolValue = mappingEngine.extractValue({ value: 'true' }, 'value', undefined, 'all', 'boolean');
      expect(boolValue).toBe(true);

      const customFnValue = mappingEngine.extractValue(
        { value: 'john' },
        'value',
        undefined,
        'all',
        (val) => `mr_${val}`
      );
      expect(customFnValue).toBe('mr_john');
    });
  });

  // 3. YAML Generation Tests
  describe('YamlGenerator', () => {
    it('should generate valid execution flow YAML representation', () => {
      const yamlContent = yamlGenerator.generateYaml('TestFlow');
      expect(yamlContent).toContain('flowName: TestFlow');
      expect(yamlContent).toContain('id: create_user');
      expect(yamlContent).toContain('id: link_bank');
      expect(yamlContent).toContain('endpointId: create_user');
      expect(yamlContent).toContain('assignTo: body.userId');
      expect(yamlContent).toContain('request:');
      expect(yamlContent).toContain('body:');
      expect(yamlContent).toContain('name: Jane Doe');
      expect(yamlContent).toContain('age: 25');
      expect(yamlContent).toContain('bodyTypes:');
      expect(yamlContent).toContain('name: string');
      expect(yamlContent).toContain('age: number');
      expect(yamlContent).toContain('queryParams:');
      expect(yamlContent).toContain('filter: Alpha');
    });
  });

  // 4. Flow Executor Tests
  describe('FlowExecutor', () => {
    it('should sort steps topologically without cycles', () => {
      const steps = [
        { id: 'step_c', dependsOn: [{ endpointId: 'step_b' }] },
        { id: 'step_a', dependsOn: [] },
        { id: 'step_b', dependsOn: [{ endpointId: 'step_a' }] }
      ];

      const sorted = (flowExecutor as any).topologicalSort(steps);
      expect(sorted[0].id).toBe('step_a');
      expect(sorted[1].id).toBe('step_b');
      expect(sorted[2].id).toBe('step_c');
    });

    it('should evaluate when expressions correctly', () => {
      const mockState = {
        steps: {
          create_user: {
            status: 201,
            headers: {},
            body: { active: true }
          }
        }
      };

      const resultTrue = (flowExecutor as any).evaluateCondition(
        'steps.create_user.body.active === true',
        mockState
      );
      expect(resultTrue).toBe(true);

      const resultFalse = (flowExecutor as any).evaluateCondition(
        'steps.create_user.body.active === false',
        mockState
      );
      expect(resultFalse).toBe(false);
    });

    it('should initialize request payload with default body and queryParams', async () => {
      const step = {
        id: 'test_step',
        path: '/test',
        method: 'POST',
        request: {
          body: { key: 'value' },
          queryParams: { page: 1 }
        }
      };

      const dispatchSpy = jest.spyOn(flowExecutor as any, 'dispatchRequest').mockResolvedValue({
        status: 200,
        headers: {},
        body: { success: true }
      });

      const flowYaml = {
        steps: [step]
      };

      const state = await flowExecutor.executeFlow(flowYaml, 'http://localhost');
      expect(dispatchSpy).toHaveBeenCalledWith(
        'http://localhost',
        '/test',
        'POST',
        expect.objectContaining({
          body: { key: 'value' },
          query: { page: 1 },
          params: {},
          headers: {}
        })
      );
      dispatchSpy.mockRestore();
    });
  });
});
