<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 -->
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
