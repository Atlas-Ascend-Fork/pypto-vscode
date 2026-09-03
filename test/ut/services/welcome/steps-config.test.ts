/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

// Mock extensionContext using vi.hoisted
const { mockGlobalState, mockExtensionContext } = vi.hoisted(() => {
  const mockGlobalState = {
    get: vi.fn(),
    update: vi.fn(),
  };

  const mockExtensionContext = {
    globalState: mockGlobalState,
  };

  return { mockGlobalState, mockExtensionContext };
});

vi.mock('../../../../src/extension', () => ({
  extensionContext: mockExtensionContext,
}));

import {
  registerWebviewMessageListener,
  updateWelcomeState,
  getWelcomeState,
  getIsCompleteBoot,
  getIsOpen,
  getIsSuccessBoot,
} from '../../../../src/services/welcome/steps-config';

describe('welcome/steps-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerWebviewMessageListener', () => {
    it('should update guide progress when message type is updateGuideProgress', async () => {
      const message = {
        type: 'updateGuideProgress',
        data: {
          bigGroup: 2,
          smallIndex: 3,
        },
      };

      await registerWebviewMessageListener(message);

      expect(mockGlobalState.update).toHaveBeenCalledWith('guide.currentBigGroup', 2);
      expect(mockGlobalState.update).toHaveBeenCalledWith('guide.currentSmallIndex', 3);
    });

    it('should not update when extensionContext is null', async () => {
      const originalContext = mockExtensionContext;
      vi.mocked(await import('../../../../src/extension')).extensionContext = null;

      const message = {
        type: 'updateGuideProgress',
        data: {
          bigGroup: 2,
          smallIndex: 3,
        },
      };

      await registerWebviewMessageListener(message);

      expect(mockGlobalState.update).not.toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('插件未激活，无法获取上下文！');

      vi.mocked(await import('../../../../src/extension')).extensionContext = originalContext;
    });

    it('should handle unknown message types', async () => {
      const message = {
        type: 'unknownType',
        data: {},
      };

      await registerWebviewMessageListener(message);

      expect(mockGlobalState.update).not.toHaveBeenCalled();
    });
  });

  describe('updateWelcomeState', () => {
    it('should update welcome state with key and value', async () => {
      const params = {
        key: 'guide.currentStep',
        value: 5,
      };

      await updateWelcomeState(params);

      expect(mockGlobalState.update).toHaveBeenCalledWith('guide.currentStep', 5);
    });

    it('should not update when extensionContext is null', async () => {
      const originalContext = mockExtensionContext;
      vi.mocked(await import('../../../../src/extension')).extensionContext = null;

      const params = {
        key: 'guide.currentStep',
        value: 5,
      };

      await updateWelcomeState(params);

      expect(mockGlobalState.update).not.toHaveBeenCalled();

      vi.mocked(await import('../../../../src/extension')).extensionContext = originalContext;
    });

    it('should handle string values', async () => {
      const params = {
        key: 'guide.status',
        value: 'completed',
      };

      await updateWelcomeState(params);

      expect(mockGlobalState.update).toHaveBeenCalledWith('guide.status', 'completed');
    });

    it('should handle boolean values', async () => {
      const params = {
        key: 'guide.isComplete',
        value: true,
      };

      await updateWelcomeState(params);

      expect(mockGlobalState.update).toHaveBeenCalledWith('guide.isComplete', true);
    });
  });

  describe('getWelcomeState', () => {
    it('should get welcome state with default value 0', async () => {
      mockGlobalState.get.mockResolvedValue(5);

      const params = {
        key: 'guide.currentStep',
      };

      const result = await getWelcomeState(params);

      expect(mockGlobalState.get).toHaveBeenCalledWith('guide.currentStep', 0);
      expect(result).toBe(5);
    });

    it('should return default value when key does not exist', async () => {
      mockGlobalState.get.mockResolvedValue(0);

      const params = {
        key: 'guide.nonExistentKey',
      };

      const result = await getWelcomeState(params);

      expect(result).toBe(0);
    });

    it('should not get when extensionContext is null', async () => {
      const originalContext = mockExtensionContext;
      vi.mocked(await import('../../../../src/extension')).extensionContext = null;

      const params = {
        key: 'guide.currentStep',
      };

      const result = await getWelcomeState(params);

      expect(mockGlobalState.get).not.toHaveBeenCalled();
      expect(result).toBeUndefined();

      vi.mocked(await import('../../../../src/extension')).extensionContext = originalContext;
    });
  });

  describe('getIsCompleteBoot', () => {
    it('should return true when guide is complete', async () => {
      mockGlobalState.get.mockResolvedValue(true);

      const result = await getIsCompleteBoot();

      expect(mockGlobalState.get).toHaveBeenCalledWith('guide.state', false);
      expect(result).toBe(true);
    });

    it('should return false when guide is not complete', async () => {
      mockGlobalState.get.mockResolvedValue(false);

      const result = await getIsCompleteBoot();

      expect(result).toBe(false);
    });

    it('should return false by default', async () => {
      mockGlobalState.get.mockResolvedValue(false);

      const result = await getIsCompleteBoot();

      expect(mockGlobalState.get).toHaveBeenCalledWith('guide.state', false);
      expect(result).toBe(false);
    });

    it('should not get when extensionContext is null', async () => {
      const originalContext = mockExtensionContext;
      vi.mocked(await import('../../../../src/extension')).extensionContext = null;

      const result = await getIsCompleteBoot();

      expect(mockGlobalState.get).not.toHaveBeenCalled();
      expect(result).toBeUndefined();

      vi.mocked(await import('../../../../src/extension')).extensionContext = originalContext;
    });
  });

  describe('getIsOpen', () => {
    it('should return true when guide should be opened', async () => {
      mockGlobalState.get.mockResolvedValue(true);

      const result = await getIsOpen();

      expect(mockGlobalState.get).toHaveBeenCalledWith('guide.isOpen', true);
      expect(result).toBe(true);
    });

    it('should return false when guide should not be opened', async () => {
      mockGlobalState.get.mockResolvedValue(false);

      const result = await getIsOpen();

      expect(result).toBe(false);
    });

    it('should return true by default', async () => {
      mockGlobalState.get.mockResolvedValue(true);

      const result = await getIsOpen();

      expect(mockGlobalState.get).toHaveBeenCalledWith('guide.isOpen', true);
      expect(result).toBe(true);
    });

    it('should not get when extensionContext is null', async () => {
      const originalContext = mockExtensionContext;
      vi.mocked(await import('../../../../src/extension')).extensionContext = null;

      const result = await getIsOpen();

      expect(mockGlobalState.get).not.toHaveBeenCalled();
      expect(result).toBeUndefined();

      vi.mocked(await import('../../../../src/extension')).extensionContext = originalContext;
    });
  });

  describe('getIsSuccessBoot', () => {
    it('should return true when boot is successful', async () => {
      mockGlobalState.get.mockResolvedValue(true);

      const result = await getIsSuccessBoot();

      expect(mockGlobalState.get).toHaveBeenCalledWith('guide.isOpen', false);
      expect(result).toBe(true);
    });

    it('should return false when boot is not successful', async () => {
      mockGlobalState.get.mockResolvedValue(false);

      const result = await getIsSuccessBoot();

      expect(result).toBe(false);
    });

    it('should return false by default', async () => {
      mockGlobalState.get.mockResolvedValue(false);

      const result = await getIsSuccessBoot();

      expect(mockGlobalState.get).toHaveBeenCalledWith('guide.isOpen', false);
      expect(result).toBe(false);
    });

    it('should not get when extensionContext is null', async () => {
      const originalContext = mockExtensionContext;
      vi.mocked(await import('../../../../src/extension')).extensionContext = null;

      const result = await getIsSuccessBoot();

      expect(mockGlobalState.get).not.toHaveBeenCalled();
      expect(result).toBeUndefined();

      vi.mocked(await import('../../../../src/extension')).extensionContext = originalContext;
    });
  });
});
