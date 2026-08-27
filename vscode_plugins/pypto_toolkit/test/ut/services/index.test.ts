import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/services/control-flow', () => ({
  getControlFlow: vi.fn(),
  getSnippetCodeText: vi.fn(),
  openControlFlowTargetFile: vi.fn(),
  readProgramPath: vi.fn(),
}));

vi.mock('../../../../src/services/tmp-view-opener', () => ({
  openComputeGraph: vi.fn(),
  openControlFlow: vi.fn(),
  openOpCheck: vi.fn(),
  openTaskCheck: vi.fn(),
  openPtoConfig: vi.fn(),
  openPyPTOWelcome: vi.fn(),
  openSwimlaneGraph: vi.fn(),
  openThreeColumnGraph: vi.fn(),
}));

vi.mock('../../../../src/services/run-data/api', () => ({
  getRunDataList: vi.fn(),
  getOutputDetail: vi.fn(),
  getRunDataBySwimlaneGraphPath: vi.fn(),
  deleteRunData: vi.fn(),
}));

vi.mock('../../../../src/services/welcome', () => ({
  getInitPythonProject: vi.fn(),
  getPluginVersion: vi.fn(),
  getProgramPath: vi.fn(),
  getPythonFileCode: vi.fn(),
  getThreeColumnSamplePath: vi.fn(),
  getSwimPath: vi.fn(),
  getUserRunRoot: vi.fn(),
  isLinuxEnvironment: vi.fn(),
  completeResultsStep: vi.fn(),
  reductionResultsStep: vi.fn(),
  completeTreeColumnStep: vi.fn(),
  reductionTreeColumnStep: vi.fn(),
}));

vi.mock('../../../../src/services/welcome/steps-config', () => ({
  updateWelcomeState: vi.fn(),
  getWelcomeState: vi.fn(),
  getIsCompleteBoot: vi.fn(),
}));

vi.mock('../../../../src/services/extension-config', () => ({
  ExtensionConfig: class MockExtensionConfig {
    name = 'extension';
    constructor(..._args: any[]) {}
    dispose() {}
  },
}));

vi.mock('../../../../src/services/run-data', () => ({
  RunDataService: class MockRunDataService {
    name = 'runData';
    constructor(..._args: any[]) {}
    dispose() {}
  },
}));

vi.mock('../../../../src/services/schema-config/configdata', () => ({
  ConfigDataService: class MockConfigDataService {
    name = 'configData';
    constructor(..._args: any[]) {}
    dispose() {}
  },
}));

vi.mock('../../../../src/services/schema-config/run-config-language-features', () => ({
  RunConfigLanguageFeaturesService: class MockRunConfigLanguageFeaturesService {
    name = 'language-features';
    constructor(..._args: any[]) {}
    dispose() {}
  },
}));

import { serviceApis, startAllServices, closeAllServices, useService } from '../../../../src/services';

describe('services/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('serviceApis', () => {
    it('should have welcome API group', () => {
      expect(serviceApis.welcome).toBeDefined();
      expect(serviceApis.welcome.getInitPythonProject).toBeDefined();
      expect(serviceApis.welcome.isLinuxEnvironment).toBeDefined();
      expect(serviceApis.welcome.getPluginVersion).toBeDefined();
      expect(serviceApis.welcome.getPythonFileCode).toBeDefined();
    });

    it('should have controlFlow API group', () => {
      expect(serviceApis.controlFlow).toBeDefined();
      expect(serviceApis.controlFlow.getControlFlow).toBeDefined();
      expect(serviceApis.controlFlow.getSnippetCodeText).toBeDefined();
      expect(serviceApis.controlFlow.openControlFlowTargetFile).toBeDefined();
      expect(serviceApis.controlFlow.readProgramPath).toBeDefined();
    });

    it('should have workspace API group', () => {
      expect(serviceApis.workspace).toBeDefined();
      expect(serviceApis.workspace.getRunDataList).toBeDefined();
      expect(serviceApis.workspace.getOutputDetail).toBeDefined();
      expect(serviceApis.workspace.getRunDataBySwimlaneGraphPath).toBeDefined();
      expect(serviceApis.workspace.deleteRunData).toBeDefined();
    });

    it('should have tmpViewOpener API group', () => {
      expect(serviceApis.tmpViewOpener).toBeDefined();
      expect(serviceApis.tmpViewOpener.openControlFlow).toBeDefined();
      expect(serviceApis.tmpViewOpener.openComputeGraph).toBeDefined();
      expect(serviceApis.tmpViewOpener.openSwimlaneGraph).toBeDefined();
      expect(serviceApis.tmpViewOpener.openPyPTOWelcome).toBeDefined();
    });
  });

  describe('startAllServices', () => {
    it('should be a function', () => {
      expect(typeof startAllServices).toBe('function');
    });
  });

  describe('closeAllServices', () => {
    it('should be a function', () => {
      expect(typeof closeAllServices).toBe('function');
    });
  });

  describe('useService', () => {
    it('should be a function', () => {
      expect(typeof useService).toBe('function');
    });
  });
});
