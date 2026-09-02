/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
/// <reference types="@types/vscode-webview" />
/// <reference types="vite/client" />

import { WebviewApi } from 'vscode-webview';
import type { ViewQuery } from 'ext:/core/view/view-query';
import type { GmMemoryPerformanceRun } from './src/components/memoryUsage/memoryPerformance';

declare global {
  interface Window {
    __gmMemoryPerformance?: GmMemoryPerformanceRun;
    vscode: WebviewApi<unknown>;
    extensionQuery: ViewQuery;
  }
}
