/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { computed, ref, watch } from 'vue';
import { comGraphStore } from '../../../service/com-graph-store';
import { extractFuncMap } from '../../../utils/search';

export function useNavbar() {
  const funcMap = ref({});
  const curPath = ref([]);
  const comGraphName = computed(() => {
    if (curPath.value.length) {
      return funcMap.value[curPath.value[curPath.value.length - 1]]?.func_magicname ?? '';
    }
    return '';
  });

  watch(
    () => comGraphStore.data.calleeMap,
    (val) => {
      if (Object.keys(val).length === 0) {
        return;
      }
      funcMap.value = extractFuncMap(val);
    },
    { immediate: true },
  );

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.command == 'returnFuncTree') {
      curPath.value = typeof message.curPath === 'string' ? JSON.parse(message.curPath) : message.curPath;
    }
  });

  return { comGraphName };
}
