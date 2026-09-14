<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 -->
<script setup lang="ts">
import { onMounted, ref, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
const { t: $t } = useI18n();
const { isDarkTheme } = inject('root');
let iconPath = computed(() => `${(window as any).staticPath}/static-assets/noFile${isDarkTheme.value ? 'Dark' : ''}.png`);
</script>

<template>
    <div class="no-file-container">
        <div><img :src="iconPath" alt="" class="no-file-icon" /></div>
        <div class="no-file-title">{{ $t('noDataText')}}</div>
    </div>
</template>

<style scoped>

</style>
<style lang="scss">
.no-file-container {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    height: 100%;
    .devui-button {
        border-radius: 8px;
    }
}
.no-file-title {
    font-size: 16px;
    font-weight: 500;
    color: var(--devui-category-search-font-color)
}
.no-file-icon {
    width: 100px;
    height: 100px;
}
.mt10 {
    margin-top: 10px;
}
.no-file-back {
    background: var(--devui-primary-button-bg) !important;

    &:hover {
        background: var(--devui-primary-button-hover-bg) !important;
    }
}
</style>
