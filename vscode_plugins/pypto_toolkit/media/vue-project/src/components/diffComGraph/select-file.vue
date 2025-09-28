<template>
  <div class="select-file">
    <d-button @click="selectFiles">{{ t('selectFile') }}</d-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { SelectFileChangeEventParam } from './type';

const emits = defineEmits<{
  (e: 'change', param: SelectFileChangeEventParam): void;
}>();

const { t } = useI18n();

const selectFiles = () => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.style.position = 'fixed';
    input.style.left = '-2000px';
    input.style.top = '-2000px';
    input.setAttribute('type', 'file');
    input.setAttribute('accept', '.json');
    input.addEventListener('change', (event) => {
      resolve(Array.prototype.slice.call((event.target as HTMLInputElement).files));
      onChange((event.target as HTMLInputElement).files?.[0]);
    });
    document.body.appendChild(input);
    input.click();
  });
};

function onChange(file?: File) {
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const fileContent = processFileContent(JSON.parse(content));
        if (fileContent) {
          emits('change', { fileContent, fileName: file.name.replace('.json', '') });
        }
      }
    };
    reader.readAsText(file);
  }
}

function processFileContent(value: Record<string, any>) {
  let result = {};
  let entryHash = value.entryhash ?? '';
  if (value.functions) {
    const funcHashMap = {};
    value.functions.forEach((funcItem: any) => {
      const hash = String(funcItem.hash);
      funcHashMap[hash] = {
        functype: funcItem.functype || null,
        func_magicname: funcItem.func_magicname || null,
      };
    });

    value.functions.forEach((funcItem: any) => {
      const callHashArr: string[] = [];
      // 获取callHashArr
      funcItem.operations.forEach((operation: any) => {
        if (operation.calleehash) {
          callHashArr.push(String(operation.calleehash));
          if (Array.isArray(operation.attr) && operation.attr !== 0) {
            operation.attr[0] = operation.calleehash;
          }
          operation.functype = funcHashMap[operation.calleehash]?.functype;
          operation.func_magicname = funcHashMap[operation.calleehash]?.func_magicname;
        }
      });
      result[funcItem.hash] = funcItem;
    });
  }
  if (entryHash) {
    return result[entryHash];
  }
  return {};
}
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