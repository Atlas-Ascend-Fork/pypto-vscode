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

import { FitToScreenAction } from 'sprotty-protocol';

export function createFitAction(options?: {
  maxZoom?: number;
  elementIds?: string[];
  animate?: boolean;
  padding?: number;
  center?: boolean;
}): FitToScreenAction {
  return {
    kind: 'fit',
    maxZoom: options?.maxZoom ?? 1.0,
    padding: options?.padding ?? 50,
    elementIds: options?.elementIds ?? [],
    animate: options?.animate ?? false,
    ...(options?.center !== undefined && { center: options.center }),
  };
}
