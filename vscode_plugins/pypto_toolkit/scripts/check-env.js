/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', 'src', 'env.ts');
const content = fs.readFileSync(envFile, 'utf-8');

if (content.includes('IS_DEBUG = true')) {
  process.stderr.write('\x1b[31mERROR: Cannot publish in DEBUG mode!\x1b[0m\n');
  process.stderr.write('\x1b[31mPlease change IS_DEBUG to false in src/env.ts before publishing.\x1b[0m\n');
  process.exit(1);
}

process.stdout.write('\x1b[32mEnvironment check passed: Production mode\x1b[0m\n');
process.exit(0);