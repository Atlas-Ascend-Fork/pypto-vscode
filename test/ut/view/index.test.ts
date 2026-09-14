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
