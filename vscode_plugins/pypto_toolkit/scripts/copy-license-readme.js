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

const fileList = ['LICENSE', 'README.md', 'README.en.md'];

for (const fileName of fileList) {
  const src = path.join(__dirname, '..', '..', '..', fileName);
  const dst = path.join(__dirname, '..', fileName);

  if (!fs.existsSync(src)) {
    process.stderr.write(`\x1b[31mERROR: ${fileName} not found at ${src}\x1b[0m\n`);
    process.exit(1);
  }

  fs.copyFileSync(src, dst);
  process.stdout.write(`\x1b[32m${fileName} copied: ${src} → ${dst}\x1b[0m\n`);
}
process.exit(0);
