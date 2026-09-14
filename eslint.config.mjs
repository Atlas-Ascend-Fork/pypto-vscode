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
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**', 'webview-dist/**', 'media/vue-project/**', 'node_modules/**', '*.min.js', 'test/**', '*thirdParty/**'],
  },
  {
    files: ['**/*.{ts,js,mjs}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.commonjs,
        ...globals.es6,
        ...globals.mocha,
      },
    },
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
