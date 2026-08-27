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

const mockRegisterViews = vi.fn();

vi.mock(import('../../../src/core/editorView'), () => {
  class MockEditorView {
    registerViews = mockRegisterViews;
    open = vi.fn();
    closeAll = vi.fn();
  }
  return { EditorView: MockEditorView };
});

vi.mock(import('../../../src/view/routes'), () => ({
  routes: {
    computeGraph: { title: 'Compute Graph', viewServer: class {} },
    swimGraph: { title: 'Swim Graph', viewServer: class {} },
  },
}));

import { initView, useView } from '../../../src/view/index';

describe('initView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates EditorView and registers routes', () => {
    const result = initView();
    expect(result.editorView).toBeDefined();
    expect(mockRegisterViews).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ viewType: 'computeGraph' }),
        expect.objectContaining({ viewType: 'swimGraph' }),
      ]),
    );
  });
});

describe('useView', () => {
  it('returns editorView after initView', () => {
    initView();
    const result = useView();
    expect(result.editorView).toBeDefined();
  });
});
