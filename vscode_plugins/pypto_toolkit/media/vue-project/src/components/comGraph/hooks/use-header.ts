import type { Ref } from 'vue';

export function useHeader(isVisible: Ref<boolean>) {
  let selectedTags = [];

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

  return { onCategoryClick, onSelectedTagsChange, onSelectClick };
}
