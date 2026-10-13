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
