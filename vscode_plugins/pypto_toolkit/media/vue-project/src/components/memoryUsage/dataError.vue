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
  <div class="data-error">
    <div class="data-error__content">
      <div class="data-error__title">{{ $t('dataError.title') }}</div>
      <div class="data-error__message">{{ $t('dataError.message') }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DataError',
};
</script>

<style scoped>
.data-error {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #fff;
}

.data-error__content {
  text-align: center;
}

.data-error__title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--devui-title-text);
}

.data-error__message {
  font-size: 14px;
  color: var(--devui-secondary-text);
}
</style>