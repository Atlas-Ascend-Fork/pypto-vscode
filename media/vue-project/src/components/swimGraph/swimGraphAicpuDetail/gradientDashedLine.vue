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
    <svg class="gradient-dashed-line">
        <defs>
            <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" id="startStop" :stop-color="leftColor"/>
                <stop offset="100%" id="endStop" :stop-color="rightColor" />
            </linearGradient>
        </defs>
        <path
            d="M0 0 L40 1"
            :stroke="`url(#${gradientId})`"
            stroke-width="1"
            fill="none"
            stroke-dasharray="4,4"
        />
    </svg>
</template>

<script setup>
import { ref, inject, watch} from 'vue';
const gradientId = ref(`gradDashedLine-${Math.random().toString(36).substr(2,9)}`);
const props = defineProps({
    leftColor: {
        type: String,
        default: '#ffffff'
    },
    rightColor: {
        type: String,
        default: '#ffffff'
    }
});
</script>

<style scoped lang="scss">
.gradient-dashed-line {
    width: 40px;
    height: 1px;
    min-width: 40px;
}
</style>