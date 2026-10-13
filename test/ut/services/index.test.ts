/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
  readProgramConfiguredPath: vi.fn(),
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
  warnComputeGraphNotExist: vi.fn(),
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
