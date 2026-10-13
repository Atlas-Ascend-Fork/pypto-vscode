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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

 */
import fs from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

export function generateDebugHtml(): Plugin {
  /** vue项目根目录 */
  let root: string;

  /** 构建输出目录 */
  let outDir: string;

  /** 开发模式server域名 */
  let serverHost: string;
  return {
    name: 'generate-debug-html',
    apply: 'serve',
    configResolved(resolvedConfig) {
      root = resolvedConfig.root;
      outDir = resolvedConfig.build.outDir;
      const { host = 'localhost', port = 5173 } = resolvedConfig.server;
      serverHost = `http://${host}:${port}`;
    },
    buildStart() {
      const htmlPath = path.join(root, 'index.html');
      const outputPath = path.join(outDir, 'index.html');
      const htmlText = fs
        .readFileSync(htmlPath, 'utf-8')
        .replaceAll('{{staticPath}}', `${serverHost}/src`)
        .replaceAll('/src/main.ts', `${serverHost}/src/main.ts`);

      // 生成构建输出目录和debug html文件
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outputPath, htmlText);
    },
  };
}
