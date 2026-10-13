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
