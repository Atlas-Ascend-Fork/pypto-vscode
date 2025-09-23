import type { Ref } from 'vue';

export function useHeader(isVisible: Ref<boolean>) {
  let selectedTags = [];

  const hideCategorySearchDropdown = () => {
    const dom = document.querySelector('.devui-flexible-overlay:has(.dp-category-search-dropdown)');
    if (dom) {
      dom.style.display = 'none';
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

  return { onCategoryClick, onSelectedTagsChange, onSelectClick };
}
