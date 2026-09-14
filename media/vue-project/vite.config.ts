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
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import'],
      }
    }
  },
  server: {
    hmr: mode !== 'test',
    cors: {
      origin: /^vscode-webview:\/\//,
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import', 'legacy-js-api'],
      },
    },
  },
  build: {
    outDir: mode === 'test' ? '../../.test-webview-dist' : '../../webview-dist',
    emptyOutDir: true,
    sourcemap: false,
    cssMinify: 'esbuild',
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      }
    }
  },
}));
