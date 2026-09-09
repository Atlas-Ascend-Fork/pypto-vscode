/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You should not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const disposedNames: string[] = [];

vi.mock('../../../src/services/extension-config', () => ({
  ExtensionConfig: class {
    name = 'extension';
    dispose() {
      disposedNames.push('extension');
    }
  },
}));

vi.mock('../../../src/services/run-data', () => ({
  RunDataService: class {
    name = 'runData';
    dispose() {
      disposedNames.push('runData');
    }
  },
}));

vi.mock('../../../src/services/schema-config/configdata', () => ({
  ConfigDataService: class {
    name = 'configData';
    dispose() {
      disposedNames.push('configData');
    }
  },
}));

vi.mock('../../../src/services/schema-config/run-config-language-features', () => ({
  RunConfigLanguageFeaturesService: class {
    dispose() {
      disposedNames.push('language-features');
    }
  },
}));

vi.mock('../../../src/services/control-flow', () => ({
  getControlFlow: vi.fn(),
  getSnippetCodeText: vi.fn(),
  openControlFlowTargetFile: vi.fn(),
  readProgramPath: vi.fn(),
}));

vi.mock('../../../src/services/tmp-view-opener', () => ({
  openControlFlow: vi.fn(),
  openComputeGraph: vi.fn(),
  openSwimlaneGraph: vi.fn(),
  openOpCheck: vi.fn(),
  openTaskCheck: vi.fn(),
  openPtoConfig: vi.fn(),
  openPyPTOWelcome: vi.fn(),
  openThreeColumnGraph: vi.fn(),
}));

vi.mock('../../../src/services/run-data/api', () => ({
  getRunDataList: vi.fn(),
  fetchRunDataDetail: vi.fn(),
  getRunDataBySwimlaneGraphPath: vi.fn(),
  deleteRunData: vi.fn(),
}));

vi.mock('../../../src/services/welcome', () => ({
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

vi.mock('../../../src/services/welcome/steps-config', () => ({
  updateWelcomeState: vi.fn(),
  getWelcomeState: vi.fn(),
  getIsCompleteBoot: vi.fn(),
}));

import { startAllServices, closeAllServices, useService, serviceApis } from '../../../src/services';

describe('services/index', () => {
  beforeEach(() => {
    disposedNames.length = 0;
  });

  it('exposes service api groups', () => {
    expect(Object.keys(serviceApis)).toEqual(
      expect.arrayContaining(['welcome', 'controlFlow', 'workspace', 'tmpViewOpener']),
    );
  });

  it('startAllServices creates singleton services', () => {
    startAllServices({} as any);

    expect(useService('extension').name).toBe('extension');
    expect(useService('runData').name).toBe('runData');
    expect(useService('configData').name).toBe('configData');
    expect(useService('extension')).toBe(useService('extension'));
  });

  it('closeAllServices disposes all services', () => {
    startAllServices({} as any);

    closeAllServices();

    expect(disposedNames).toEqual(
      expect.arrayContaining(['extension', 'runData', 'configData', 'language-features']),
    );
  });
});
