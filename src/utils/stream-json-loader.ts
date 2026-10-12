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

// stream-json 3.x 为纯 ESM 包，扩展编译目标为 CommonJS 时 tsc 会把 import() 改写为 require()，
// 在内嵌 Node < 22.12 的旧版 VS Code 中抛 ERR_REQUIRE_ESM。通过 new Function 构造编译期不可见的
// 原生动态 import，保证 engines 范围内所有 VS Code 版本均可加载（原生 import 自 Node 12 起可用）。
const nativeImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;

async function importModule(specifier: string): Promise<any> {
  try {
    return await nativeImport(specifier);
  } catch {
    // 部分 sandbox/worker 环境（如 vitest worker）未提供动态 import 回调，回退到环境自带的动态 import
    return await import(/* @vite-ignore */ specifier);
  }
}

export interface StreamJsonToolkit {
  parser: typeof import('stream-json')['parser'];
  streamValues: typeof import('stream-json/streamers/stream-values.js')['streamValues'];
  streamArray: typeof import('stream-json/streamers/stream-array.js')['streamArray'];
  streamObject: typeof import('stream-json/streamers/stream-object.js')['streamObject'];
  chain: typeof import('stream-chain')['default'];
}

let toolkitPromise: Promise<StreamJsonToolkit> | undefined;

export function loadStreamJsonToolkit(): Promise<StreamJsonToolkit> {
  if (!toolkitPromise) {
    toolkitPromise = (async () => {
      const [streamJson, streamValuesMod, streamArrayMod, streamObjectMod, streamChain] = await Promise.all([
        importModule('stream-json'),
        importModule('stream-json/streamers/stream-values.js'),
        importModule('stream-json/streamers/stream-array.js'),
        importModule('stream-json/streamers/stream-object.js'),
        importModule('stream-chain'),
      ]);
      return {
        parser: streamJson.parser,
        streamValues: streamValuesMod.streamValues,
        streamArray: streamArrayMod.streamArray,
        streamObject: streamObjectMod.streamObject,
        chain: streamChain.default,
      };
    })().catch((err) => {
      toolkitPromise = undefined;
      throw err;
    });
  }
  return toolkitPromise;
}
