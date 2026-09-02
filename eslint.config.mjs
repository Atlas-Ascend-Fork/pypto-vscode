/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import globals from 'globals';

export default [
  {
    files: ['**/*.{ts,js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.commonjs,
        ...globals.es6,
        ...globals.mocha,
      },
    },
    ignores: ['dist/**', 'webview-dist/**', 'media/vue-project/**', 'node_modules/**', '*.min.js', 'test/**', '*thirdParty/**'],
  },
  {
    rules: {
      'no-const-assign': 'warn',
      'no-this-before-super': 'warn',
      'no-undef': 'warn',
      'no-unreachable': 'warn',
      'no-unused-vars': 'warn',
      'constructor-super': 'warn',
      'valid-typeof': 'warn',
      'semi': 'warn',
      'object-curly-spacing': ['warn', 'always', { arraysInObjects: false, objectsInObjects: false }],
      'keyword-spacing': ['warn', { before: true, after: true }],
      'max-len': ['warn', { code: 140, tabWidth: 2 }],
    },
  },
];
