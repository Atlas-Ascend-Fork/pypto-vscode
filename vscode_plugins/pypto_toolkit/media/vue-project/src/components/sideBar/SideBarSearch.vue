<script setup lang="ts">
import { debounce } from 'lodash-es';
import { nextTick, ref } from 'vue';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'search', keyword: string): void;
}>();

const isActive = ref(true);
const searchInput = ref(null);
const keyword = ref('');

function activeSearchInput() {
  keyword.value = props.modelValue;
  isActive.value = true;
  nextTick(() => {
    searchInput.value.focus();
  });
}

function handleSearch() {
  emit('search', keyword.value);
}

const debounceSearch = debounce(handleSearch, 500);
</script>

<template>
  <div class="side-bar-search">
    <d-input
      v-if="isActive"
      v-model="keyword"
      ref="searchInput"
      class="search-input"
      icon-position="left"
      :placeholder="$t('sideBar.searchPlaceholder')"
      clearable
      @clear="handleSearch"
      @keyup.enter="handleSearch"
      @input="debounceSearch"
    >
      <template #prefix>
        <d-icon name="search"></d-icon>
      </template>
    </d-input>
    <i v-else class="icon icon-search-new" @click="activeSearchInput"></i>
  </div>
</template>

<style lang="less" scoped>
.side-bar-search {
  padding: 0 16px;

  .search-input {
    width: calc(100vw - 32px);
  }

  .icon-search-new {
    cursor: pointer;
    font-size: 16px;
    padding: 6px;

    &:hover {
      color: var(--devui-link-text);
    }
  }
}
</style>
