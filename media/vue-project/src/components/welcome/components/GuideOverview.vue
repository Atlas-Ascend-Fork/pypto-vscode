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
    <div class="collapse-panle">
        <d-collapse v-model="activeCollapseNames">
            <!-- 循环渲染所有引导大组 -->
            <d-collapse-item v-for="(group, groupIndex) in guideStepsConfigStep2" :key="groupIndex"
                :name="group.webviewType">
                <template #title>
                    <div class="item_title">
                        <!-- 大组图标：根据不同webviewType匹配对应图标 -->
                        <img :src="getGroupImgUrl(group.webviewType)" alt="" class="group-icon" />
                        {{ t(group.groupName) }}
                    </div>
                </template>

                <!-- 循环渲染当前大组下的所有步骤 -->
                <div class="steps-item" v-for="(step, stepIndex) in group.steps" :key="stepIndex">
                    <!-- 完成状态：显示完成图标；未完成：显示步骤序号 -->

                    <template v-if="isStepCompleted(groupIndex, stepIndex)">
                        <img :src="hasCompletedImg" class="item__completed" />
                    </template>
                    <template v-else>
                        <div class="item__number">{{ (stepIndex + 1).toString().padStart(2, '0') }}</div>
                    </template>

                    <!-- 步骤描述：使用国际化后的实际步骤内容 -->
                    <div class="step-desc">{{ t(step.content) }}</div>
                </div>
            </d-collapse-item>

        </d-collapse>
    </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, inject, ref, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { guideStepsConfigStep2, guideStepsConfigStep3 } from '../guideStepsConfig';

const { t } = useI18n();
const { isDarkTheme } = inject('root');

// ========== 核心：响应式状态管理 ==========
// 折叠面板默认展开项（可根据需求调整，比如默认展开第一个大组）
const activeCollapseNames = ref(['controlFlow']);

// 步骤完成状态：结构 { 大组索引: { 步骤索引: 是否完成 } }
const completedSteps = reactive<Record<number, Record<number, boolean>>>({});

const groupImgMap = computed(() => {
    const themeSuffix = isDarkTheme.value ? '' : '-light';
    return {
        controlFlow: `${window.staticPath}/static-assets/boot_steps/boot_steps_control${themeSuffix}.svg`,
        navigation: `${window.staticPath}/static-assets/boot_steps/boot_steps_native${themeSuffix}.svg`,
        computeGraph: `${window.staticPath}/static-assets/boot_steps/boot_steps_compute${themeSuffix}.svg`,
        swimlaneGraph: `${window.staticPath}/static-assets/boot_steps/boot_steps_swim${themeSuffix}.svg`
    };
});
// 完成状态图标（需要替换）
const hasCompletedImg = ref(`${window.staticPath}/static-assets/boot_steps/boot_steps_welcome_completed.svg`);

// ========== 工具方法 ==========
/**
 * 获取指定大组的图标URL
 * @param webviewType 大组类型（controlFlow/navigation等）
 */
const getGroupImgUrl = (webviewType: string) => {
    return groupImgMap.value[webviewType as keyof typeof groupImgMap.value] || groupImgMap.value.controlFlow;
};

/**
 * 判断指定步骤是否完成
 * @param groupIndex 大组索引
 * @param stepIndex 步骤索引
 */
const isStepCompleted = (groupIndex: number, stepIndex: number): boolean => {
    return completedSteps[groupIndex]?.[stepIndex] || false;
};

/**
 * 更新步骤完成状态（引导调用，如“下一步”按钮点击时）
 * @param groupIndex 大组索引
 * @param stepIndex 步骤索引
 * @param isCompleted 是否完成（默认true）
 */
const updateStepCompletion = (
    groupIndex: number,
    stepIndex: number,
    isCompleted: boolean = true
) => {
    // 初始化大组状态（若不存在）
    if (!completedSteps[groupIndex]) {
        completedSteps[groupIndex] = {};
    }
    // 更新指定步骤的完成状态
    completedSteps[groupIndex][stepIndex] = isCompleted;
};


defineExpose({
    updateStepCompletion
});
</script>

<style lang="less">
.collapse-panle {
    height: 100%;
    overflow-y: auto;
    padding-bottom: 50px;

    .steps-item {
        display: flex;
        align-items: start;
        gap: 8px;
        padding: 8px 16px;
        cursor: default;

        .item__completed {
            width: 16px;
            height: 16px;
        }

        .item__number {
            display: flex;
            align-items: center;
            width: 16px;
            height: 16px;
            line-height: 16px;
            font-size: 12px;
            color: var(--devui-text-regular);
            font-weight: 400;
        }

        .step-desc {
            flex: 1;
            font-size: 14px;
            color: var(--devui-text-regular);
            line-height: 1.4;
        }

        &:hover {
            background-color: var(--devui-input-active-bg);
        }
    }
}

.item_title {
    display: flex;
    align-items: center;
    gap: 8px;

    .group-icon {
        width: 16px;
        height: 16px;
    }
}

.devui-collapse__item {
    border-bottom: 1px solid var(--pto-border-default);
}

.devui-collapse__item-content {
    padding: 0 !important;
    background-color: var(--devui-global-bg);
}

.devui-collapse__item-title {
    background-color: var(--devui-global-bg) !important;
    font-size: 14px;
    font-weight: 500;
    padding: 0 16px !important;
    &:hover {
        background-color: var(--devui-input-active-bg) !important;
    }
}

.devui-collapse {
    overflow: auto !important;
}
</style>