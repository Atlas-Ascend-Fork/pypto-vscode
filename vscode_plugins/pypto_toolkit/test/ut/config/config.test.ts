/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect } from 'vitest';

import { globalConfig } from '../../../src/config/config';

describe('globalConfig', () => {
  it('has IS_USE_DB set to true', () => {
    expect(globalConfig.IS_USE_DB).toBe(true);
  });

  it('is frozen and cannot be modified', () => {
    expect(Object.isFrozen(globalConfig)).toBe(true);
  });
});
