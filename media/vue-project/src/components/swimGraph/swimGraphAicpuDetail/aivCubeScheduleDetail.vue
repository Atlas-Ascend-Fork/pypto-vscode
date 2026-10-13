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
  <div class="dispatch-aiv-status-area">
      <div class="dispatch-aiv-area" :style="{ '--aiv-thread-num': aivThreadNum}">
        <div class="row">
          <div
            v-for="(item, index) in Math.floor(aivThreadNum / 2)"
            :key="`aiv-${(index + aicEndNum)}`"
           >
           <d-tooltip :content="'AIV_' + (index + aicEndNum)">
              <div :class = "{ active : (index + aicEndNum) >= aivDispatchNumstart && (index + aicEndNum) < aivDispatchNumend}"></div>
            </d-tooltip>
          </div>
        </div>
        <div class="row">
          <div
            v-for="(item, index) in Math.floor(aivThreadNum / 2)"
            :key="`aiv-${index + aicEndNum + Math.floor(aivThreadNum / 2)}`"
          >
          <d-tooltip :content="'AIV_' + (index + aicEndNum + Math.floor(aivThreadNum / 2))">
            <div :class = "{ active : index + aicEndNum + Math.floor(aivThreadNum / 2) >= aivDispatchNumstart && index + aicEndNum + Math.floor(aivThreadNum / 2) < aivDispatchNumend}"></div>
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

const props = defineProps({
    aivDispatchNumstart: {
        type:Number,
        default: 0
    },
    aivDispatchNumend: {
        type:Number,
        default: 0
    },
    aicEndNum: {
        type:Number,
        default: 0
    },
    aivThreadNum: {
        type:Number,
        default: 48
    }
});

const lineColor = ref('rgba(255, 255, 255, 0.4)');
const divDefaultColor = ref('rgba(61, 61, 61, 1)');

const {
    isDarkTheme
} = inject('swimGraphState');

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
@import url("../css/swimGraph/AicpuDetail/aivCubeScheduleDetail.css");
</style>