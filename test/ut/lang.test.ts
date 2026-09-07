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
import { env } from 'vscode';
import { getIDELang } from '../../src/lang';

describe('lang', () => {
  afterEach(() => {
    (env as any).language = 'en';
  });

  it('maps en to en', () => {
    (env as any).language = 'en';
    expect(getIDELang()).toBe('en');
  });

  it('maps zh-cn to zh', () => {
    (env as any).language = 'zh-cn';
    expect(getIDELang()).toBe('zh');
  });

  it('falls back to zh for unknown languages', () => {
    (env as any).language = 'fr';
    expect(getIDELang()).toBe('zh');
  });
});
