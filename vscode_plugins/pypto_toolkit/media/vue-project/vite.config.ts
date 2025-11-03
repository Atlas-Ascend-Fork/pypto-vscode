import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

import { copy } from './vite-plugin/copy';
import { generateDebugHtml } from './vite-plugin/generate-debug-html';
import { transformIndexHtml } from './vite-plugin/transformIndexHtml';
import Components from 'unplugin-vue-components/vite';
import { DevUiResolver } from 'unplugin-vue-components/resolvers';
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    copy({
      targets: [
        { src: './node_modules/@devui-design/icons/icomoon', dest: './src/static-assets/icomoon' },
        { src: './node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon', dest: './src/static-assets/codicon' },
        { src: './src/static-assets', dest: '../../webview-dist/static-assets' },
      ],
    }),
    generateDebugHtml(),
    transformIndexHtml(),
    Components({
      resolvers: [DevUiResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'ext:': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  build: {
    outDir: '../../webview-dist',
    emptyOutDir: true,
  },
});
