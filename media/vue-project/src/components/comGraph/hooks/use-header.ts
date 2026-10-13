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
