<script setup lang="ts">
import { onMounted, ref, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useViewServer } from '../../core/use-view-server';
import { ICommonViewServer } from 'ext:/view/servers/view-server-interface';
const { t: $t } = useI18n();
const { server } = useViewServer<ICommonViewServer>();
const { isDarkTheme } = inject('root');
const props = defineProps({
  graphType: { type: String },
  filePath: {type: Object, default: {}}
});
let iconPath = computed(() => `${(window as any).staticPath}/static-assets/noFile${isDarkTheme.value ? 'Dark' : ''}.png`);
let graphName = props.graphType === 'swimGraph' ? $t('swimGraph') : $t('comGraphName');
function openFilePath() {
    const {swimPath, comPath} = props.filePath;
    server.selectFile({graphType: props.graphType, options: {swimPath, comPath}});
}
</script>

<template>
    <div class="no-file-container">
        <div><img :src="iconPath" alt="" class="no-file-icon" /></div>
        <div class="no-file-title">{{ $t('noJsonFile', { graphName }) }}</div>
        <d-button variant="solid" @click="openFilePath" class="mt10">{{ $t('openFile') }}</d-button>
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
    width: 160px;
    height: 160px;
}
.mt10 {
    margin-top: 10px;
}
</style>
