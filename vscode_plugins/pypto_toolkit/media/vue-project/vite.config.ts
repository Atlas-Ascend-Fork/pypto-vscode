/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

import { copy } from './vite-plugin/copy';
import { generateDebugHtml } from './vite-plugin/generate-debug-html';
import { transformIndexHtml } from './vite-plugin/transformIndexHtml';
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    copy({
      targets: [
        { src: './node_modules/@devui-design/icons/icomoon', dest: './src/static-assets/icomoon' },
        { src: './node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon', dest: './src/static-assets/codicon' },
        { src: './src/static-assets', dest: '../../webview-dist/static-assets' },
        { src: '../../src/python-file', dest: '../../webview-dist/python-file' },
        { src: '../../src/boot-mock-data', dest: '../../webview-dist/boot-mock-data' },
      ],
    }),
    generateDebugHtml(),
    transformIndexHtml(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'ext:': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  server: {
    hmr: mode !== 'test',
    cors: {
      origin: /^vscode-webview:\/\//,
    },
  },
  build: {
    outDir: mode === 'test' ? '../../.test-webview-dist' : '../../webview-dist',
    emptyOutDir: true,
    sourcemap: false,
    cssMinify: 'esbuild',
  },
}));
