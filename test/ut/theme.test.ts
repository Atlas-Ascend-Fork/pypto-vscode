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
