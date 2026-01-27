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
                    <d-button variant="solid" color='primary' @click="exportConfirm()">{{ $t('exportImageGraph')
                    }}</d-button>
                </d-modal-footer>
            </template>
        </d-modal>
    </div>
</template>

<script setup>
import { useViewServer } from '../../core/use-view-server';
import { Message } from 'vue-devui/message';
import { ref, watch, onMounted, computed } from 'vue';
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

const pureFileName = computed(() => props.fileName.endsWith('svg') ? (props.fileName || 'com-graph-export.svg') : (props.fileName+'.png' || 'swim-graph-export.png'));

function setupImageWatchers() {
    watch(server.CheckSysResult, (newValue) => {
        if (newValue.sustem === 'windows') {
            server.saveFile({ dataUrl: props.dataUrl, fileName: pureFileName.value });
        } else {
            modalVisible.value = true;
            exportRadioItem.value = 'local';
            exportPath.value = '';
        }
    });
    watch(server.SaveDirPath, (newValue) => {
        exportPath.value = newValue.dir + `/${pureFileName.value}`;
    });
    watch(server.SaveFileResult, (newValue) => {
        if (newValue.result) {
            const fileNameInfo = props.fileName.endsWith('svg') ? (props.fileName || 'com-graph-export.svg') : (props.fileName+'.png' || 'swim-graph-export.png');
            window.ascEventBus.on('message_notice', onMessageNotice('success', $t('imageExportSuccessInfo', { fileNameInfo })));
        } else {
            window.ascEventBus.on('message_notice', onMessageNotice('error', $t('imageExportErrorInfo')));
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
        link.download = pureFileName.value;
        link.href = props.dataUrl;
        link.click();
    } else {
        const fileNameInfo = pureFileName.value;
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
    setupImageWatchers();
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