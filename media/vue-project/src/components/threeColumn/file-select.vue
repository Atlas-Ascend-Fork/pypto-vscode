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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 -->
<!--
 * file-select 组件使用说明
 *
 * Props:
 *   fileName        当前显示的文件名（String，必传）
 *   showDropdown    是否显示下拉列表（Boolean，默认 false）
 *                   true 时显示文件名旁的下拉 icon，点击文件名或 icon 展开文件列表
 *   showFileExplorer 是否显示文件资源管理器 icon（Boolean，默认 true）
 *                   点击打开 VS Code 文件选择器
 *   fileList        下拉列表数据（Array<FileSelectItem>，默认 []）
 *                   FileSelectItem: { path: string; name: string; exists: boolean }
 *                   exists=false 的文件置灰不可点击，tooltip 提示"文件不存在"
 *   currentPath     当前选中文件的完整路径（String，用于高亮当前项）
 *   filePaths       传递给 threeColumnServer.selectFile 的路径信息（Object）
 *
 * Events:
 *   fileSelect      点击存在的文件时触发，参数为文件完整路径
 *                   调用方在此事件中调用服务端切换文件并处理锁定状态
 *
 * 使用示例（threeColumn.vue）:
 *   <fileSelect
 *     :file-name="editorFileName"
 *     :show-dropdown="true"
 *     :file-list="pyFileList"
 *     :current-path="editorFilePath"
 *     @file-select="onPyFileSwitch"
 *   />
 *
 *   const onPyFileSwitch = (path: string) => {
 *     (window as any).ascEventBus.emit('deactivateLock');  // 退出锁定
 *     threeColumnServer.switchPyFile({ paramObj: { path } });  // 切换文件
 *   };
 -->
<template>
  <div class="file-select-wrapper">
    <div class="file-select">
      <d-tooltip :content="props.fileName">
        <div class="simple-com-file-name" @click="onFileNameClick">{{ props.fileName }}</div>
      </d-tooltip>
      <div v-if="props.showDropdown && fileList.length" class="icon-line-height" @click="toggleDropdown">
        <d-icon :name="isDropdownOpen ? 'icon-chevron-up-2' : 'icon-chevron-down-2'" class="simple-com-file-name-icon" size="16px"></d-icon>
      </div>
      <div v-if="props.showFileExplorer" class="icon-line-height" @click="onFileExplorerClick">
        <d-icon name="icon-switch" class="simple-com-file-name-icon" size="16px"></d-icon>
      </div>
    </div>
    <div v-if="isDropdownOpen && props.showDropdown" class="file-dropdown">
      <div
        v-for="file in fileList"
        :key="file.path"
        class="file-dropdown-item"
        :class="{ disabled: !file.exists, active: file.path === currentPath }"
        @mouseenter="onItemMouseEnter(file, $event)"
        @mouseleave="onItemMouseLeave"
        @click="onFileItemClick(file)"
      >
        {{ file.name }}
      </div>
    </div>
    <teleport to="body">
      <div v-if="tooltip.visible" class="py-file-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
        {{ tooltip.text }}
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { IThreeColumnCtx, ISwimGraphState } from './types';
import { ThreeColumnProvideKey, SwimGraphStateKey } from './types';
import { useViewServer } from '../../core/use-view-server';
import { ThreeColumnServer } from '../../../../../src/core/view/three-column-server';

export interface FileSelectItem {
  path: string;
  name: string;
  exists: boolean;
}

const { server: threeColumnServer } = useViewServer<ThreeColumnServer>();
const { currentActiveBlock, BlockToGraphMap } = inject(ThreeColumnProvideKey) as IThreeColumnCtx;
const { baseChoose } = inject('runDataList');
const swimGraphState = inject(SwimGraphStateKey) as ISwimGraphState | undefined;

const props = defineProps({
  fileName: { type: String, default: '' },
  filePaths: { type: Object, default: () => ({}) },
  showDropdown: { type: Boolean, default: false },
  showFileExplorer: { type: Boolean, default: true },
  fileList: { type: Array as () => FileSelectItem[], default: () => [] },
  currentPath: { type: String, default: '' },
});

const emit = defineEmits<{
  dropdownClick: [];
  fileSelect: [path: string];
}>();

const { t } = useI18n();
const isDropdownOpen = ref(false);
const tooltip = ref({ visible: false, text: '', x: 0, y: 0 });

const onItemMouseEnter = (file: FileSelectItem, e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  tooltip.value = {
    visible: true,
    text: file.exists ? file.path : t('fileNotExist'),
    x: rect.left,
    y: rect.top - 30,
  };
};

const onItemMouseLeave = () => {
  tooltip.value.visible = false;
};

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value;
}

function onFileNameClick() {
  if (props.showDropdown && props.fileList.length) {
    toggleDropdown();
  } else {
    openSelectedFileWindow();
  }
}

function onFileItemClick(file: FileSelectItem) {
  if (!file.exists) {
    return;
  }
  isDropdownOpen.value = false;
  tooltip.value.visible = false;
  emit('fileSelect', file.path);
}

function onFileExplorerClick() {
  isDropdownOpen.value = false;
  openSelectedFileWindow();
}

function onOutsideClick(e: MouseEvent) {
  const wrapper = (e.target as HTMLElement).closest('.file-select-wrapper');
  if (!wrapper) {
    isDropdownOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener('click', onOutsideClick);
});

function openSelectedFileWindow() {
  baseChoose.value = '';
  if (BlockToGraphMap[currentActiveBlock.value] === 'swimGraph' && swimGraphState?.detailsPanelExpanded?.value === true) {
    swimGraphState.detailsPanelExpanded.value = false;
  }
  if (BlockToGraphMap[currentActiveBlock.value] === 'editor') {
    threeColumnServer.singleSelectFile({ graphType: BlockToGraphMap[currentActiveBlock.value] });
  } else {
    const { swimPath, comPath } = props.filePaths;
    threeColumnServer.selectFile({ graphType: BlockToGraphMap[currentActiveBlock.value], options: { swimPath, comPath } });
  }
}
</script>

<style scoped lang="scss">
.file-select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.file-select {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.simple-com-file-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--devui-tooltip-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
  display: inline-block;
  word-break: keep-all;
  overflow-wrap: normal;
  hyphens: none;
}

.simple-com-file-name-icon {
  width: 16px;
  height: 16px;
  color: var(--devui-primary-text);
}

.file-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  min-width: 200px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--devui-card-bg);
  border: 1px solid var(--devui-split-line);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.file-dropdown-item {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--devui-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;

  &:hover {
    background: var(--devui-list-item-hover-bg);
  }

  &.disabled {
    color: var(--devui-disabled-text);
    cursor: not-allowed;
    pointer-events: auto;

    &:hover {
      background: none;
    }
  }

  &.active {
    color: var(--devui-brand);
    font-weight: 600;
  }
}

.py-file-tooltip {
  position: fixed;
  z-index: 9999;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--devui-tooltip-text);
  background: var(--devui-tooltip-bg);
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
</style>
