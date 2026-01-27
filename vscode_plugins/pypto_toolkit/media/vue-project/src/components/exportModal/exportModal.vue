<template>
    <div>
        <d-modal v-model="modalVisible" :title="$t('iconExport')" class="export-modal-containner"
            :close-on-click-overlay="false">
            <div class="export-title">{{ $t('exportPosition') }}</div>
            <d-radio-group class="mt10" direction="row" v-model="exportRadioItem" @change="groupRadioChange">
                <d-radio v-for="item in exportRadioList" :key="item.name" :value="item.value">{{ item.name }}</d-radio>
            </d-radio-group>
            <div class="export-title mt20" v-if="exportFoldVisible">{{ $t('exportFold') }}</div>
            <div class="mt10 export-fold" v-if="exportFoldVisible">
                <d-input class="label-input" v-model="exportPath" :placeholder="$t('editInput')" show-count
                    :maxlength="16">
                    <template #append>
                        <d-button variant="solid" @click="setExportFold()"> {{ $t('setExportFold') }}</d-button>
                    </template>
                </d-input>
            </div>
            <template #footer>
                <d-modal-footer class="modal-button mt10">
                    <d-button variant="solid" color='secondary' @click="exportCancel()">{{ $t('no') }}</d-button>
                    <d-button variant="solid" color='primary' @click="exportConfirm()">{{ $t('exportSwimGraph')
                    }}</d-button>
                </d-modal-footer>
            </template>
        </d-modal>
    </div>
</template>
<script setup>
import { useViewServer } from '../../core/use-view-server';
import { Message } from 'vue-devui/message';
import { ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
const { t: $t } = useI18n();
const { server } = useViewServer();
const exportRadioList = [{ name: $t('exportLocal'), value: 'local' }, { name: 'Linux', value: 'linux' }];
let exportRadioItem = ref('local');
const exportPath = ref('');
const modalVisible = ref(false);
const exportFoldVisible = ref(false);
const props = defineProps({
    dataUrl: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  }
});
function setupSwimWatchers() {
    watch(server.CheckSysResult, (newValue) => {
        if (newValue.sustem === 'windows') {
            const fileNameInfo = `${props.fileName}.png` || 'swim-graph-export.png';
            server.saveFile({ dataUrl: props.dataUrl, fileName: fileNameInfo });
        } else {
            modalVisible.value = true;
        }
    });
    watch(server.SaveDirPath, (newValue) => {
        const fileNameInfo = `${props.fileName}.png` || 'swim-graph-export.png';
        exportPath.value = newValue.dir + `/${fileNameInfo}`;
    });
    watch(server.SaveFileResult, (newValue) => {
        if (newValue.result) {
            const fileNameInfo = `${props.fileName}.png` || 'swim-graph-export.png';
            window.ascEventBus.on('message_notice', onMessageNotice('success', $t('swimExportSuccessInfo', { fileNameInfo })));
        } else {
            window.ascEventBus.on('message_notice', onMessageNotice('error', $t('swimExportErrorInfo')));
        }
    });
}
function onMessageNotice(type, text) {
    Message({
        type: type,
        message: text
    });
};
const exportCancel = () => {
    modalVisible.value = false;
};
const exportConfirm = () => {
    if (exportRadioItem.value === 'local') {
        const link = document.createElement('a');
        link.download = `${props.fileName}.png` || 'swim-graph-export.png';
        link.href = props.dataUrl;
        link.click();
    } else {
        const fileNameInfo = `${props.fileName}.png` || 'swim-graph-export.png';
        server.saveFile({ dataUrl: props.dataUrl, fileName: fileNameInfo, filePath: exportPath.value });
        modalVisible.value = false;
    }
};
const setExportFold = () => {
    server.setSaveDir();
};
const groupRadioChange = (item) => {
    exportFoldVisible.value = item === 'linux';
};
onMounted(() => {
    setupSwimWatchers();
});
</script>
<style lang="scss">
@import url("./exportModal.css");
</style>
<style scoped lang="scss">
.label-input {
    :deep() {
        .devui-input__wrapper {
            border: none;
        }

        .devui-input-slot__prepend,
        .devui-input-slot__append {
            border: none;
            border-left: 1px solid var(--devui-form-control-line);
        }
    }
}
</style>