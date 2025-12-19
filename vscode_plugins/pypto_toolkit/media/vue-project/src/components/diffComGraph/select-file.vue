<template>
  <div class="select-file">
    <d-button @click="selectFiles">{{ t('selectFile') }}</d-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Message } from 'vue-devui/message';
import type { SelectFileChangeEventParam } from './type';
import { useViewServer } from '../../core/use-view-server';
import { IComViewServer } from 'ext:/view/servers/view-server-interface';
import { watch } from 'vue';

const props = defineProps({ beforeFilePath: String });
const emits = defineEmits<{
  (e: 'change', param: SelectFileChangeEventParam): void;
}>();

const { t } = useI18n();
const { server } = useViewServer<IComViewServer>();

const selectFiles = () => {
  server.selectFile(props.beforeFilePath);
};

watch(server.AfterDiffData, (newValue: Record<string, any>) => {
  emits('change', { fileContent: newValue.fileContent, fileName: newValue.fileName });
});

watch(server.SameDiffFile, () => {
  Message({
    type: 'warning',
    message: t('sameDiffFileTips'),
  });
});
</script>

<style scoped lang="scss">
.select-file {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  width: fit-content;
}
</style>
