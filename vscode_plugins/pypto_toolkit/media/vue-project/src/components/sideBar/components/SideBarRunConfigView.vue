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
  <div class="sidebar-container">
    <!-- 标题栏 -->
    <div class="header">
      <div class="name">{{ t('sideBar.config.configTitle') }}</div>
      <div class="expand" @click="configExpand">
        <d-icon :name="isExpanded ? 'icon-chevron-up-2' : 'icon-chevron-down-2'"></d-icon>
      </div>
      <div class="refresh" :class="{ hidden: isExpanded }" @click="handleRefresh">
        <d-icon name="refresh"></d-icon>
      </div>
    </div>
    <div class="config-list" :class="{ hidden: isExpanded }">
      <!-- 每组数据 -->
      <template v-for="config in configFiles" :key="config.path">
        <div class="config-item" @click="openEditView(config)">
          <div class="config-item__title">{{ config.fileName }}</div>
          <div class="config-item__path">{{ adaptRtlText(config.path) }}</div>
        </div>
      </template>
      <div v-if="isScanning" class="scanning">{{ $t('runConfig.scanning') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ConfigFileInfo } from 'ext:/types/config-schema';
import { SidebarViewServer } from 'ext:/view/servers/sidebar-view-server';

import { openPtoConfig } from '@/apis/opener';
import { useViewServer } from '@/core/use-view-server';

const { t } = useI18n();
const { server } = useViewServer<SidebarViewServer>();
const { isScanning, configFiles } = server;

function handleRefresh(): void {
  server.refreshConfigList();
}

const isExpanded = ref(false);
const emit = defineEmits<{ (e: 'tree-expand', value: boolean) }>();
function configExpand() {
  isExpanded.value = !isExpanded.value;
  emit('tree-expand', isExpanded.value);
}

function adaptRtlText(content: string): string {
  // 起始是特殊字符，移动到文本末尾
  if (/^[^\w]/.test(content)) {
    return `${content.slice(1)}${content[0]}`;
  }
  return content;
}

/**
 * 打开运行配置编辑页
 */
function openEditView(config: ConfigFileInfo): void {
  openPtoConfig({ configPath: config.path, pathName: config.fileName });
}
</script>

<style scoped lang="less">
/**
 * 基础样式
 */
.sidebar-container {
  color: var(--pto-font-color-main);
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border-bottom: 1px solid var(--pto-border-default);
  display: flex;
  flex-direction: column;

  .header {
    display: flex;
    align-items: center;
    height: 28px;
    padding: 0 16px;

    .name {
      color: var(--pto-font-color-title);
      font-size: 14px;
      line-height: 28px;
    }

    .expand {
      width: 28px;
      height: 28px;
      padding: 7px;
      font-size: 14px;
      cursor: pointer;

      :deep(*) {
        color: var(--pto-font-color-title);
      }
    }

    .refresh {
      width: 28px;
      height: 28px;
      padding: 7px;
      font-size: 14px;
      cursor: pointer;

      &:hover {
        :deep(*) {
          color: var(--devui-link-text);
        }
      }

      :deep(*) {
        color: var(--pto-font-color-title);
      }
    }
  }

  .config-list {
    flex: 1;
    padding: 8px 0;
    overflow-y: auto;

    .config-item {
      width: 100%;
      height: 48px;
      cursor: pointer;
      padding: 4px 20px;
      border-bottom: 1px solid var(--pto-border-default);

      &:hover {
        background-color: var(--pto-background-hover);
      }

      &__title {
        font-size: 14px;
        line-height: 22px;
      }

      &__path {
        font-size: 12px;
        line-height: 18px;
        color: var(--pto-font-color-sub);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        direction: rtl;
        text-align: left;
      }
    }
  }

  .scanning {
    text-align: center;
    line-height: 28px;
  }
}
</style>
