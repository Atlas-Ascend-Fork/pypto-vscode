/**
 * Copyright (c) 2026 Huawei Technologies Co., Ltd.
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