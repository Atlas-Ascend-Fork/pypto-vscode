/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
