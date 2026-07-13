/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { watch, onBeforeUnmount, ref } from 'vue';

export function useClickOutside(props: any, emits: any, ignoreId?: string) {
  const drawerEl = ref();

  const onClickOutside = (e: MouseEvent) => {
    const composedPath = e.composedPath();
    if (ignoreId && composedPath.some((item) => item.id === ignoreId)) {
      return;
    }
    if (!composedPath.includes(drawerEl.value)) {
      emits('update:modelValue', false);
    }
  };

  watch(
    () => props.modelValue,
    (val) => {
      if (val) {
        setTimeout(() => {
          document.documentElement.addEventListener('click', onClickOutside);
        });
      } else {
        document.documentElement.removeEventListener('click', onClickOutside);
      }
    },
  );

  onBeforeUnmount(() => {
    document.documentElement.removeEventListener('click', onClickOutside);
  });

  return { drawerEl };
}
