/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defaultBaseColorList, defaultBaseColorListInDark, defaultLightColorList, defaultLightColorListInDark } from '../../src/defaultColor';

describe('color-list (before material-color-utilities loaded)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getHct returns null initially', async () => {
    const mod = await import('../../src/color-list');
    expect(mod.getHct()).toBeNull();
  });

  it('getLighterColorByHex returns the input color unchanged', async () => {
    const mod = await import('../../src/color-list');
    expect(mod.getLighterColorByHex('#aabbcc')).toBe('#aabbcc');
  });

  it('generateColorList falls back to default dark lists', async () => {
    const mod = await import('../../src/color-list');

    const dark = mod.generateColorList(5, true);
    expect(dark.baseColorList).toEqual(defaultBaseColorListInDark);
    expect(dark.lightColorList).toEqual(defaultLightColorListInDark);

    const light = mod.generateColorList(5, false);
    expect(light.baseColorList).toEqual(defaultBaseColorList);
    expect(light.lightColorList).toEqual(defaultLightColorList);
  });
});

describe('color-list (with material-color-utilities)', () => {
  it('loads Hct and generates themed color lists', async () => {
    const mod = await import('../../src/color-list');
    const Hct = await mod.loadMaterialColorUtilities();

    expect(Hct).toBeDefined();
    expect(mod.getHct()).toBe(Hct);

    const dark = mod.generateColorList(5, true);
    expect(dark.baseColorList).toHaveLength(5);
    expect(dark.lightColorList).toHaveLength(5);
    dark.baseColorList.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
    dark.lightColorList.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));

    const light = mod.generateColorList(5, false);
    expect(light.baseColorList).not.toEqual(dark.baseColorList);
  });

  it('getLighterColorByHex computes a lighter variant', async () => {
    const mod = await import('../../src/color-list');
    await mod.loadMaterialColorUtilities();

    const result = mod.getLighterColorByHex('#305079');

    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('getColorByString', () => {
  it('maps the same string to the same color pair deterministically', async () => {
    const mod = await import('../../src/color-list');
    const base = ['#111111', '#222222', '#333333'];
    const light = ['#aaaaaa', '#bbbbbb', '#cccccc'];

    const first = mod.getColorByString('someNode', base, light);
    const second = mod.getColorByString('someNode', base, light);

    expect(first).toEqual(second);
    expect(base).toContain(first.baseColor);
    expect(light[base.indexOf(first.baseColor)]).toBe(first.lightColor);
  });

  it('distributes different strings across the palette', async () => {
    const mod = await import('../../src/color-list');
    const base = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'];
    const light = base.map(() => '#ffffff');

    const colors = new Set(Array.from({ length: 20 }, (_, i) => mod.getColorByString(`node_${i}`, base, light).baseColor));

    expect(colors.size).toBeGreaterThan(1);
  });
});
