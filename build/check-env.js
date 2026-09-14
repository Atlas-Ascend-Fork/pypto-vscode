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