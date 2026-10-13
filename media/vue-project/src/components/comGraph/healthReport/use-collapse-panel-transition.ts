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
