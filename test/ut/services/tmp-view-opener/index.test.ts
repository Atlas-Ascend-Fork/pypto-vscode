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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

// Mock useView and useService
const mockEditorView = {
  open: vi.fn(),
};

const mockRunDataService = {
  getOutputRecord: vi.fn(),
};

vi.mock('../../../../src/view', () => ({
  useView: vi.fn(() => ({
    editorView: mockEditorView,
  })),
}));

vi.mock('../../../../src/services', () => ({
  useService: vi.fn((serviceName: string) => {
    if (serviceName === 'runData') {
      return mockRunDataService;
    }
    return null;
  }),
}));

const mockReadProgramConfiguredPath = vi.fn();
vi.mock('../../../../src/services/control-flow', () => ({
  readProgramConfiguredPath: (...args: any[]) => mockReadProgramConfiguredPath(...args),
}));

import {
  openControlFlow,
  openComputeGraph,
  openSwimlaneGraph,
  openOpCheck,
  openTaskCheck,
  openPtoConfig,
  openPyPTOWelcome,
  openThreeColumnGraph,
  warnComputeGraphNotExist,
} from '../../../../src/services/tmp-view-opener';
import { useView } from '../../../../src/view';
import { useService } from '../../../../src/services';

describe('tmp-view-opener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('openControlFlow', () => {
    it('should open control flow view with correct parameters', async () => {
      mockRunDataService.getOutputRecord.mockResolvedValue({
        title: 'Test Output',
        computeGraphDirPath: '/path/to/compute',
        flowVerifyPath: '/path/to/verify',
      });

      await openControlFlow({
        outputPath: '/path/to/output',
        controlFlowPath: '/path/to/control-flow.json',
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'controlFlow',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            url: '/path/to/output',
            outputPath: '/path/to/output',
            isBootStep: false,
            computeGraphDirPath: '/path/to/compute',
            flowVerifyPath: '/path/to/verify',
          }),
          title: expect.stringContaining('Test Output'),
        })
      );
    });

    it('should handle missing controlFlowPath', async () => {
      mockRunDataService.getOutputRecord.mockResolvedValue(null);

      await openControlFlow({
        outputPath: '/path/to/output',
        controlFlowPath: '',
      });

      expect(mockEditorView.open).toHaveBeenCalled();
      const callArgs = mockEditorView.open.mock.calls[0];
      expect(callArgs[1].fsPath).toBe('FileIsNull');
    });

    it('should handle isBootStep parameter', async () => {
      mockRunDataService.getOutputRecord.mockResolvedValue(null);

      await openControlFlow({
        outputPath: '/path/to/output',
        controlFlowPath: '/path/to/control-flow.json',
        isBootStep: true,
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'controlFlow',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            isBootStep: true,
          }),
        })
      );
    });
  });

  describe('openComputeGraph', () => {
    it('should open compute graph view with correct parameters', async () => {
      await openComputeGraph({
        outputPath: '/path/to/output',
        computeGraphPath: '/path/to/compute.json',
        pathName: 'test_path',
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'computeGraph',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            outputDirPath: '/path/to/output',
            outputPath: '/path/to/output',
            pathName: 'test_path',
            isBootStep: false,
          }),
          title: 'compute.json',
        })
      );
    });

    it('should handle optional parameters', async () => {
      await openComputeGraph({
        outputPath: '/path/to/output',
        computeGraphPath: '/path/to/compute.json',
        pathName: 'test_path',
        fileType: 'json',
        computeGraphDirPath: '/path/to/compute-dir',
        flowVerifyPath: '/path/to/verify',
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'computeGraph',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            fileType: 'json',
            computeGraphDirPath: '/path/to/compute-dir',
            flowVerifyPath: '/path/to/verify',
          }),
        })
      );
    });
  });

  describe('openSwimlaneGraph', () => {
    it('should open swimlane graph view with correct parameters', async () => {
      await openSwimlaneGraph({
        swimlaneGraphPath: '/path/to/swimlane.json',
        outputPath: '/path/to/output',
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'swimGraph',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            isBootStep: false,
            outputPath: '/path/to/output',
          }),
        })
      );
    });

    it('should handle isBootStep parameter', async () => {
      await openSwimlaneGraph({
        swimlaneGraphPath: '/path/to/swimlane.json',
        isBootStep: true,
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'swimGraph',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            isBootStep: true,
          }),
        })
      );
    });
  });

  describe('openOpCheck', () => {
    it('should open OpCheck view and close sidebar', async () => {
      mockRunDataService.getOutputRecord.mockResolvedValue({
        title: 'Test Output',
      });

      await openOpCheck({
        outputPath: '/path/to/output',
      });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.closeSidebar');
      expect(mockEditorView.open).toHaveBeenCalledWith(
        'opCheck',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            outputPath: '/path/to/output',
          }),
          title: expect.stringContaining('OpCheck'),
        })
      );
    });

    it('should handle optional parameters', async () => {
      mockRunDataService.getOutputRecord.mockResolvedValue(null);

      await openOpCheck({
        outputPath: '/path/to/output',
        flowVerifyPath: '/path/to/verify',
        computeGraphDirPath: '/path/to/compute',
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'opCheck',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            flowVerifyPath: '/path/to/verify',
            computeGraphDirPath: '/path/to/compute',
          }),
        })
      );
    });
  });

  describe('openTaskCheck', () => {
    it('should open TaskCheck view and close sidebar', async () => {
      mockRunDataService.getOutputRecord.mockResolvedValue({
        title: 'Test Output',
        swimlaneGraphFilePath: '/path/to/swimlane.json',
      });

      await openTaskCheck({
        outputPath: '/path/to/output',
      });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.closeSidebar');
      expect(mockEditorView.open).toHaveBeenCalledWith(
        'taskCheck',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            outputPath: '/path/to/output',
            swimGraphPath: '/path/to/swimlane.json',
          }),
          title: expect.stringContaining('TaskCheck'),
        })
      );
    });

    it('should handle optional parameters', async () => {
      mockRunDataService.getOutputRecord.mockResolvedValue(null);

      await openTaskCheck({
        outputPath: '/path/to/output',
        flowVerifyPath: '/path/to/verify',
        computeGraphDirPath: '/path/to/compute',
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'taskCheck',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            flowVerifyPath: '/path/to/verify',
            computeGraphDirPath: '/path/to/compute',
          }),
        })
      );
    });
  });

  describe('openPtoConfig', () => {
    it('should open PTO config view with custom title', async () => {
      await openPtoConfig({
        configPath: '/path/to/config.json',
        pathName: 'Custom Config',
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'editRunConfig',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            url: '/path/to/config.json',
            isBootStep: false,
          }),
          title: 'Custom Config',
        })
      );
    });

    it('should use default title when pathName is empty', async () => {
      await openPtoConfig({
        configPath: '/path/to/config.json',
        pathName: '',
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'editRunConfig',
        expect.any(Object),
        expect.objectContaining({
          title: expect.any(String),
        })
      );
    });
  });

  describe('openPyPTOWelcome', () => {
    it('should open welcome view', async () => {
      await openPyPTOWelcome();

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'welcome',
        expect.any(Object)
      );
    });
  });

  describe('openThreeColumnGraph', () => {
    it('should open three column graph view with correct paths', () => {
      openThreeColumnGraph({
        sameplePath: '/path/to/sample',
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'threeColumnGraph',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            isBootStep: false,
            swim: expect.stringContaining('merged_swimlane.json'),
            comput: expect.stringContaining('program.json'),
          }),
        })
      );
    });

    it('should handle isBootStep parameter', () => {
      openThreeColumnGraph({
        isBootStep: true,
        sameplePath: '/path/to/sample',
      });

      expect(mockEditorView.open).toHaveBeenCalledWith(
        'threeColumnGraph',
        expect.any(Object),
        expect.objectContaining({
          query: expect.objectContaining({
            isBootStep: true,
          }),
        })
      );
    });
  });

  describe('warnComputeGraphNotExist', () => {
    it('should show warning message with the configured program file path', async () => {
      mockReadProgramConfiguredPath.mockResolvedValue('/test/configured/program.json');

      await warnComputeGraphNotExist({ outputPath: '/test/output' });

      expect(mockReadProgramConfiguredPath).toHaveBeenCalledWith({ outputPath: '/test/output' });
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('pypto.computeGraphFileNotExist');
    });

    it('should show warning message with empty path when rundata cannot be read', async () => {
      mockReadProgramConfiguredPath.mockResolvedValue(null);

      await warnComputeGraphNotExist({ outputPath: '/test/output' });

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('pypto.computeGraphFileNotExist');
    });
  });
});
