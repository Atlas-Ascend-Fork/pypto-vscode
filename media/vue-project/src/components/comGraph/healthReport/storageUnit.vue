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
  <div :class="['storage-unit', type]" :style="{ width: width + 'px', height: height + 'px' }">
    <div class="buffer">Buffer</div>
    <div class="content">
      <div class="title-box">
        <span class="title">{{ titles[0] }}</span>
        <span class="split">/</span>
        <span class="title">{{ titles[1] }}</span>
      </div>
      <div class="count-box">
        <span class="count">{{ counts[0] }}</span>
        <span class="split">/</span>
        <span class="count">{{ counts[1] }}</span>
      </div>
    </div>
    <div class="badge">{{ badgeText }}</div>
  </div>
</template>

<script setup lang="ts">
import { storageUnitProps } from './types';

defineProps(storageUnitProps);
</script>

<style scoped lang="scss">
.storage-unit {
  position: relative;
  border: 2px solid var(--devui-split-line-deep);
  border-radius: 8px;
  background-color: var(--devui-card-bg);
  box-sizing: border-box;

  .buffer {
    width: 100%;
    font-size: 10px;
    font-weight: 600;
    padding-top: 2px;
    padding-right: 2px;
    line-height: 14px;
    text-align: right;
    box-sizing: border-box;
  }

  .badge {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 2;
    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 12px;
    font-weight: 600;
    line-height: 15px;
    padding: 4px 10px;
    border-top-left-radius: 6px;
    border-bottom-right-radius: 8px;
  }

  &.no-data {
    .buffer {
      color: var(--devui-disabled-text);
      opacity: 0.3;
    }
    .title,
    .split {
      color: var(--devui-secondary-text-weak);
    }
    .count {
      color: var(--devui-primary-text-weak);
    }
    .badge {
      color: var(--devui-status-info);
      background-color: var(--devui-status-info-bg-weak);
      opacity: 0.3;
    }
  }

  &.has-data {
    .buffer {
      color: var(--devui-disabled-text);
    }
    .title,
    .count {
      color: var(--devui-status-info);
    }
    .split {
      color: var(--devui-storage-unit-split);
    }
    .badge {
      color: var(--devui-status-info);
      background-color: var(--devui-status-info-bg-weak);
    }
  }

  .content {
    width: 100%;
    padding-top: 6px;
    padding-left: 8px;
    box-sizing: border-box;
    .title-box {
      display: flex;
      align-items: center;
      gap: 2px;
      margin-bottom: 2px;
      .title,
      .split {
        font-size: 12px;
        line-height: 14px;
      }
    }

    .count-box {
      display: flex;
      align-items: center;
      gap: 2px;
      .count {
        font-size: 16px;
        font-weight: 600;
        line-height: 20px;
      }
      .split {
        font-size: 12px;
        line-height: 16px;
      }
    }
  }
}
</style>
