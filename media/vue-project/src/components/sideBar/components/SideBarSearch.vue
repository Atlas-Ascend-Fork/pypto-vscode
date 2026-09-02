<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 -->
<script setup lang="ts">
import { debounce } from 'lodash-es';
import { nextTick, ref } from 'vue';

const emit = defineEmits<{
  (e: 'search', keyword: string): void;
}>();

const isActive = ref(false);
const searchInput = ref(null);
const keyword = ref('');

function activeSearchInput() {
  keyword.value = '';
  isActive.value = true;
  nextTick(() => {
    searchInput.value.focus();
  });
}

function handleBlur() {
  if (!keyword.value) {
    hideSearchInput();
  }
}

function handleSearch() {
  emit('search', keyword.value);
}

// 停止输入500ms，触发搜索
const debounceSearch = debounce(handleSearch, 500);

/**
 * 隐藏输入框
 */
function hideSearchInput() {
  debounceSearch.flush();
  isActive.value = false;
}
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
      @blur="handleBlur"
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
  width: 28px;
  height: 28px;
  position: relative;

  .search-input {
    width: calc(100vw - 32px);
    position: absolute;
    right: 0;
  }

  .icon-search-new {
    cursor: pointer;
    font-size: 16px;
    padding: 6px 7px 6px 5px;

    &:hover {
      color: var(--devui-link-text);
    }
  }
}
</style>
