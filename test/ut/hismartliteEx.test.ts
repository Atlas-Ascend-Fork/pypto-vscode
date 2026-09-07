/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You should not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect } from 'vitest';
import { hismartliteEx } from '../../src/hismarliteEx';

describe('hismartliteEx', () => {
  it('exposes performance baseline and debug flag', () => {
    expect(typeof hismartliteEx.isDebug).toBe('boolean');
    expect(hismartliteEx.swimPerformanceBase.first.vsOpen[130]).toBe(10);
  });

  it('initHismartliteEx stores context and extension path', () => {
    const context = { extensionPath: '/ext/pypto-toolkit' } as any;

    hismartliteEx.initHismartliteEx(context);

    expect(hismartliteEx.context).toBe(context);
    expect(hismartliteEx.extensionPath).toBe('/ext/pypto-toolkit');
  });

  it('initHismartliteEx keeps extension path when context is null', () => {
    hismartliteEx.initHismartliteEx(null as any);

    expect(hismartliteEx.context).toBeNull();
  });
});
