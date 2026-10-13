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
/// <reference types="vite/client" />

import type { WebviewApi } from './src/core/webview-api';
import type { ViewQuery } from 'ext:/core/view/view-query';
import type { GmMemoryPerformanceRun } from './src/components/memoryUsage/memoryPerformance';

declare global {
  interface Window {
    __gmMemoryPerformance?: GmMemoryPerformanceRun;
    vscode: WebviewApi<unknown>;
    extensionQuery: ViewQuery;
  }
}
