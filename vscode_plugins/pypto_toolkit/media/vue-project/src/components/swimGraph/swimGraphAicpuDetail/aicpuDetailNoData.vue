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
