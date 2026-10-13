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
import { Ref, ref, watchEffect } from 'vue';

import type { OutputDetail } from 'ext:/types/workspace';

export function useOutputNav(output: Ref<OutputDetail>) {
  const sourceCodeFile = ref<string | null>(null);
  const controlFlowFile = ref<string | null>(null);
  const swimlaneFile = ref<string | null>(null);

  watchEffect(() => {
    if (!output.value) {
      return;
    }

    getOutputNavFromApi(output.value);
  });

  function getOutputNavFromApi(outputDetail: OutputDetail): void {
    for (const childDirectory of outputDetail.directoryTree?.children ?? []) {
      if (childDirectory.type === 'file' && childDirectory.fileType === 'controlFlow') {
        controlFlowFile.value = childDirectory.absolutePath;
      }
      if (childDirectory.type === 'file' && childDirectory.fileType === 'swimlaneGraph') {
        swimlaneFile.value = childDirectory.absolutePath;
      }
    }
  }

  return { sourceCodeFile, controlFlowFile, swimlaneFile };
}
