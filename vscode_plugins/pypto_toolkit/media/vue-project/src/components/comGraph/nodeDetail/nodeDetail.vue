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
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div
        v-if="modelValue"
        ref="drawerEl"
        :style="{
          height: height ? height + 40 + 'px' : 'auto',
        }"
        class="node-detail-drawer"
      >
        <div class="header">
          <span class="title">Magic: {{ magicId }}</span>
          <em class="icon icon-close" @click="() => emits('update:modelValue', false)"></em>
        </div>
        <div class="operate-wrap">
          <d-search
            icon-position="left"
            :placeholder="t('comGraph.searchPlaceholder')"
            :show-glow-style="false"
            :delay="200"
            is-keyup-search
            class="search-box"
            @search="onSearch"
          />
          <d-checkbox v-model="autoLineWrap" :label="t('comGraph.autoLineWrap')" :is-show-title="false" @change="onLineWrapChange" />
        </div>
        <div class="editor-box">
          <div class="copy-wrap">
            <div class="copy-box" @click="onCopy">
              <em :class="['icon', copied ? 'icon-right' : 'icon-copy-new']"></em>
              <span>{{ copied ? t('comGraph.copied') : t('comGraph.copy') }}</span>
            </div>
          </div>
          <div ref="editorRef" class="code-editor"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch, inject, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import * as monaco from 'monaco-editor';
import { nodeDetailProps } from './node-detail-types';
import { getTensorData, getOperationData, toClipboard } from './utils';
import { useClickOutside } from '../hooks/use-click-outside';
import { parseOpRealAttr } from '../../../sprotty-graph/parseSymbolicAttr';

const { t } = useI18n();
const props = defineProps(nodeDetailProps);
const emits = defineEmits(['update:modelValue']);

const { drawerEl } = useClickOutside(props, emits, 'sprotty');
const { isDarkTheme } = inject('root');
const magicId = ref();
const editorRef = ref();
const nodeContent = ref();
const copied = ref(false);
const autoLineWrap = ref(false);
const TensorNodeIdPrefix = 'tensor-';
const OperationNodeIdPrefix = 'operation-';
const MagicPrefix = 'magic-';
let nodeContentStr = '';
let editorIns;
let editorFindInput: HTMLTextAreaElement;
let parsedJsonData: any;

watch(
  () => props.nodeId,
  (val) => {
    if (val) {
      parsedJsonData = props.jsonContent;
      if (props.nodeId.includes(TensorNodeIdPrefix)) {
        const id = parseInt(props.nodeId.split(TensorNodeIdPrefix)[1]);
        if (!isNaN(id)) {
          magicId.value = id;
          const tensorData = getTensorData(parsedJsonData.tensors, id);
          if (tensorData) {
            nodeContent.value = JSON.stringify(tensorData, null, 2);
            nodeContentStr = JSON.stringify(tensorData);
          }
        }
      }
      if (props.nodeId.includes(OperationNodeIdPrefix) && props.nodeId.includes(MagicPrefix)) {
        const id = parseInt(props.nodeId.split(MagicPrefix)[1]);
        if (!isNaN(id)) {
          magicId.value = id;

          const operationData = getOperationData(parsedJsonData.operations, id);
          if (operationData) {
            let realOpAttr = parseOpRealAttr(JSON.parse(JSON.stringify(operationData)));

            nodeContent.value = JSON.stringify(realOpAttr, null, 2);
            nodeContentStr = JSON.stringify(realOpAttr);
          }
        }
      }
      if (editorIns && editorIns.getModel()) {
        editorIns.getModel().setValue(nodeContent.value);
      }
    }
  },
);

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      nextTick(initEditor);
    }
  },
);

watch(isDarkTheme, () => {
  updateTheme();
});

function initEditor() {
  if (editorRef.value) {
    editorIns = monaco.editor.create(editorRef.value, {
      value: nodeContent.value,
      language: 'javascript',
      readOnly: true,
      contextmenu: false,
      stickyScroll: { enabled: false },
      find: { enable: false },
      minimap: { enabled: false },
      contributions: { 'editor.contrib.findController': undefined },
    });

    editorIns.onContextMenu((e) => {
      e.event.preventDefault();
    });
    editorIns.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {});
    editorIns.addCommand(monaco.KeyCode.F3, () => {});
    editorIns.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F3, () => {});
    editorIns.getAction('actions.findWithSelection').run();
    editorFindInput = editorRef.value.querySelector('.monaco-findInput textarea.input');
    updateTheme();
  }
}

function onLineWrapChange(e: boolean) {
  editorIns.updateOptions({ wordWrap: e ? 'on' : 'off' });
}

function updateTheme() {
  let currentTheme;
  if (isDarkTheme.value) {
    currentTheme = 'vs-dark';
  } else {
    currentTheme = 'vs';
  }
  monaco.editor.setTheme(currentTheme);
}

const onSearch = (e: string) => {
  editorFindInput.value = e;
  editorFindInput.dispatchEvent(new Event('input'));
};

let timer: ReturnType<typeof setTimeout> | null;
const onCopy = () => {
  if (copied.value) {
    return;
  }
  toClipboard(nodeContentStr).then(() => {
    copied.value = true;
    timer = setTimeout(() => {
      copied.value = false;
      timer && clearTimeout(timer);
      timer = null;
    }, 1000);
  });
};

function onResize() {
  editorIns?.layout();
}

onMounted(() => {
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});
</script>

<style lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.node-detail-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1040;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 480px;
  padding: 20px;
  border-radius: var(--devui-border-radius, 4px);
  background-color: var(--devui-card-bg);
  box-shadow: -1px 0 0 0 var(--devui-split-line);
  transform: translateX(0);
  opacity: 1;
  box-sizing: border-box;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 26px;

    .title {
      font-size: 18px;
      font-weight: 600;
      line-height: 26px;
      color: var(--devui-title-text);
    }

    .icon-close {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 24px;
      height: 24px;
      color: var(--devui-icon);
      border-radius: 8px;
      transition:
        background-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth,
        color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
      cursor: pointer;

      &:hover {
        color: var(--devui-title-text);
        background-color: var(--devui-input-hover-bg);
      }
    }
  }

  .operate-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .search-box {
    flex: 1;
    height: 28px;
    .devui-search__icon {
      width: 28px;
      height: 28px;
    }

    .devui-input {
      height: 28px;
      padding-left: 26px;
      border: none;
      background-color: var(--devui-input-bg);

      .devui-input__wrapper {
        background: none;

        input {
          color: var(--devui-primary-text);
          outline: none !important;
        }
      }
    }
  }

  .editor-box {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex: 1;
    height: 0;

    .copy-wrap {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      height: 34px;
      padding: 8px 8px;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
      background-color: var(--devui-input-hover-bg);
      box-sizing: border-box;

      .copy-box {
        display: flex;
        align-items: center;
        color: var(--devui-secondary-text);
        padding: 4px 8px;
        border-radius: 8px;
        cursor: pointer;
        transition:
          color $devui-animation-duration-base $devui-animation-ease-in-out-smooth,
          background-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;

        span {
          font-size: 12px;
          font-weight: 400;
          line-height: 20px;
          margin-left: 4px;
        }

        .icon {
          font-size: 16px;
        }

        &:hover {
          color: var(--devui-operation-text-hover);
          background-color: var(--devui-secondary-button-hover-bg);
        }
      }
    }

    .code-editor {
      flex: 1;
      height: 0;

      .monaco-editor-overlaymessage {
        display: none !important;
      }

      .editor-widget.find-widget {
        display: none;
      }
    }
  }
}
</style>
