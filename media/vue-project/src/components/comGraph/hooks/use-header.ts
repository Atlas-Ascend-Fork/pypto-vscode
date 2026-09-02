/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';

export function useHeader(isVisible: Ref<boolean>) {
  let selectedTags = [];
  const dropdownEl = ref();
  const dropdownWidth = ref('0px');
  const toolbarRowEl = ref<HTMLElement>();

  const hideCategorySearchDropdown = () => {
    const dom = document.querySelector('.devui-flexible-overlay:has(.dp-category-search-dropdown)') as HTMLElement;
    if (dom) {
      dom.classList.add('hide-category-search-dropdown');
    }
  };

  const onSelectedTagsChange = (e) => {
    selectedTags = e.selectedTags;
  };

  const onCategoryClick = (e: MouseEvent) => {
    const isClickInput = e.target?.classList?.contains('dp-category-search-toggle');
    if (selectedTags.length) {
      hideCategorySearchDropdown();
    }
    if (isClickInput && isVisible.value) {
      isVisible.value = false;
    }
  };

  const onSelectClick = () => {
    if (isVisible.value) {
      isVisible.value = false;
    }
  };

  const updateDropdownWidth = () => {
    if (isVisible.value) {
      if (toolbarRowEl.value) {
        dropdownWidth.value = toolbarRowEl.value.getBoundingClientRect().width + 'px';
      }
      dropdownEl.value?.updatePosition();
    }
  };

  watch(isVisible, () => {
    nextTick(updateDropdownWidth);
  });

  onMounted(() => {
    window.addEventListener('resize', updateDropdownWidth);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateDropdownWidth);
  });

  return { dropdownEl, toolbarRowEl, dropdownWidth, onCategoryClick, onSelectedTagsChange, onSelectClick, hideCategorySearchDropdown };
}
