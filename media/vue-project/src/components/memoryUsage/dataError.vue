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