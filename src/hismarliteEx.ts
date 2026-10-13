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
import { ExtensionContext } from 'vscode';
import { IS_DEBUG } from './env';

export const hismartliteEx = {
  context: null as ExtensionContext | null,
  extensionPath: '',
  webviews: {},
  isDebug: IS_DEBUG,
  startTime: 0,
  transformStartTime: 0,
  swimPerformanceBase: {
    first: {
      vsOpen: {
        130: 10,
        380: 20,
        677: 50,
        1000: 68,
        1300: 88,
        1600: 120,
      },
      vsHW: {
        130: 13,
        380: 28,
        677: 110,
        1000: 130,
        1300: 175,
        1600: 327,
      }
    },
    useCache: {
      vsOpen: {
        130: 10,
        380: 12,
        677: 50,
      }, // 大于500M就不走cache了, 677的数据只是一个边界
      vsHW: {
        130: 12,
        380: 27,
        677: 101,
      }
    },
  },

  async initHismartliteEx(context: ExtensionContext) {
    this.context = context;
    if (this.context) {
      this.extensionPath = context.extensionPath;
    }
  },
};