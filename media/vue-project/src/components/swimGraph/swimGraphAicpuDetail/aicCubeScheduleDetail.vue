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
  <div class="dispatch-aic-status-area">
      <div class="dispatch-aic-area" :style="{ '--aic-thread-num': aicThreadNum}">
        <div class="row">
          <div
            v-for="(item, index) in Math.floor(aicThreadNum / 2)"
            :key="`aic-${(index + 1)}`"
           >
           <d-tooltip :content="'AIC_' + (index + 1)">
              <div :class = "{ active : (index + 1) >= aicDispatchNumstart && (index + 1) < aicDispatchNumend}"></div>
            </d-tooltip>
          </div>
        </div>
        <div class="row">
          <div
            v-for="(item, index) in Math.floor(aicThreadNum / 2)"
            :key="`aic-${index + Math.floor(aicThreadNum / 2) + 1}`"
          >
          <d-tooltip :content="'AIC_' + (index + Math.floor(aicThreadNum / 2) + 1)">
            <div :class = "{ active : index + Math.floor(aicThreadNum / 2) + 1 >= aicDispatchNumstart && index + Math.floor(aicThreadNum / 2) + 1 < aicDispatchNumend}"></div>
           </d-tooltip>
           </div>
        </div>
      </div>
  </div>
</template>

<script setup>
import { ref, inject, watch, onMounted} from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const lineColor = ref('rgba(255, 255, 255, 0.4)');
const divDefaultColor = ref('rgba(61, 61, 61, 1)');
const {
    isDarkTheme,
} = inject('swimGraphState');

const props = defineProps({
    aicDispatchNumstart: {
        type:Number,
        default: 5
    },
    aicDispatchNumend: {
        type:Number,
        default: 16
    },
    aicThreadNum: {
        type:Number,
        default: 24
    },
});

const updateTheme = () => {
  const theme = isDarkTheme.value ? 'dark' : 'white';
  if (theme === 'white') {
    lineColor.value = 'rgba(0, 0, 0, 0.4)';
    divDefaultColor.value = 'rgba(174, 174, 174, 1)';
    document.documentElement.style.setProperty('--lineColor', `${lineColor.value}`);
    document.documentElement.style.setProperty('--divDefaultColor', `${divDefaultColor.value}`);
  } else {
    lineColor.value = 'rgba(255, 255, 255, 0.4)';
    divDefaultColor.value = 'rgba(61, 61, 61, 1)';
    document.documentElement.style.setProperty('--lineColor', `${lineColor.value}`);
    document.documentElement.style.setProperty('--divDefaultColor', `${divDefaultColor.value}`);
  }
};

watch(isDarkTheme, () => {
  updateTheme();
});

onMounted(() => {
  updateTheme();
});

</script>

<style scoped lang="scss">
@import url("../css/swimGraph/AicpuDetail/aicCubeScheduleDetail.css");
</style>