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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 -->
<template>
  <div v-if="switchLockInformationFlag" class="lockMenu" :style="{top: topX + 'px', left: leftX + 'px'}">
    <div class="pathway-lockout-area" @click="pathwayLockoutClick">
      <div class="pathway-lockout"> {{ isPathLockStatus || isClickedPath? $t('pathwayLockout') :$t('displayPathwayLock') }} </div>
      <div class="pathway-lockout-key"> Ctrl+L </div> 
    </div>
  </div>
</template>


<script setup>
import { ref, inject, computed, watch, onMounted, provide } from 'vue';
import { useI18n } from 'vue-i18n';

const {
  switchLockInformationFlag,
  isPathLockStatus,
  topX,
  leftX,
  canvasclickedEvent,
  isClickedPath,
  pathLockedEvent,
  pathLockedWrapId
} = inject('swimGraphThreadState');

const {
  pathLockedMethod
} = inject('swimGraphThreadMethods');

const { t: $t } = useI18n();

const pathwayLockoutClick = () => {
  isPathLockStatus.value = true;
  pathLockedEvent.value = canvasclickedEvent.value;
  pathLockedWrapId.value = pathLockedEvent.value?.args?.wrapId;
  switchLockInformationFlag.value = false;
  isClickedPath.value = false;
  pathLockedMethod(canvasclickedEvent.value);
};

</script>

<style lang="scss">
@import url("../css/swimGraph/Processes/lockmenu.css");

</style>