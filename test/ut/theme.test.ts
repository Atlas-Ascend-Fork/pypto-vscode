/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You should not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { window, ColorThemeKind } from 'vscode';
import { getIDETheme } from '../../src/theme';

describe('theme', () => {
  afterEach(() => {
    (window as any).activeColorTheme = { kind: ColorThemeKind.Dark };
  });

  it('maps dark theme kinds to dark', () => {
    (window as any).activeColorTheme = { kind: ColorThemeKind.Dark };
    expect(getIDETheme()).toBe('dark');

    (window as any).activeColorTheme = { kind: ColorThemeKind.HighContrast };
    expect(getIDETheme()).toBe('dark');
  });

  it('maps light theme kinds to light', () => {
    (window as any).activeColorTheme = { kind: ColorThemeKind.Light };
    expect(getIDETheme()).toBe('light');

    (window as any).activeColorTheme = { kind: ColorThemeKind.HighContrastLight };
    expect(getIDETheme()).toBe('light');
  });

  it('falls back to dark for unknown theme kinds', () => {
    (window as any).activeColorTheme = { kind: 999 as any };
    expect(getIDETheme()).toBe('dark');
  });
});
