/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import type { RendererElement } from 'vue';

export function useCollapsePanel() {
  const beforeEnter = (el: RendererElement) => {
    if (!el.dataset) {
      el.dataset = {};
    }
    if (el.style.height) {
      el.dataset.height = el.style.height;
    }
    el.style.maxHeight = 0;
  };

  const enter = (el: RendererElement) => {
    requestAnimationFrame(() => {
      el.dataset.oldOverflow = el.style.overflow;
      if (el.dataset.height) {
        el.style.maxHeight = el.dataset.height;
      } else if (el.scrollHeight !== 0) {
        el.style.maxHeight = `${el.scrollHeight}px`;
      } else {
        el.style.maxHeight = 0;
      }
      el.style.overflow = 'hidden';
    });
  };

  const afterEnter = (el: RendererElement) => {
    el.style.maxHeight = '';
    el.style.overflow = el.dataset.oldOverflow;
  };

  const beforeLeave = (el: RendererElement) => {
    if (!el.dataset) {
      el.dataset = {};
    }
    el.dataset.oldOverflow = el.style.overflow;
    el.style.maxHeight = `${el.scrollHeight}px`;
    el.style.overflow = 'hidden';
  };

  const leave = (el: RendererElement) => {
    if (el.scrollHeight !== 0) {
      el.style.maxHeight = 0;
    }
  };

  const afterLeave = (el: RendererElement) => {
    el.style.maxHeight = '';
    el.style.overflow = el.dataset.oldOverflow;
  };

  return { beforeEnter, enter, afterEnter, beforeLeave, leave, afterLeave };
}
