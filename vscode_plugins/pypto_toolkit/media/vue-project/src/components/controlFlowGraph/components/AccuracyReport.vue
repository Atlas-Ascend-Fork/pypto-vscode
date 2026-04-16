<template>
    <Teleport to="body">
        <Transition name="drawer-fade">
            <div v-if="modelValue" ref="drawerEl" class="accuracy-report">
                <div class="accuracy-report-header">
                    <span class="title">{{ t('accuracyReport') }}</span>
                    <em class="icon icon-close" @click="() => emits('update:modelValue', false)"></em>
                </div>
                <div class="accuracy-report-content">
                    <div class="title">
                        {{ t('controlFlows.dataOverview') }}
                    </div>
                    <div class="content">
                        <div class="content-title">{{ t('controlFlows.accuracyVerificationResults') }}</div>
                        <d-row>
                            <d-col :span="12">
                                <StatisticCard type="PASS" :count="data.pass_cnt" :active-type="activeType"
                                    @handle-card="handleResult('PASS')" />
                            </d-col>
                            <d-col :span="12">
                                <StatisticCard type="FAIL" :count="data.fail_cnt" :active-type="activeType"
                                    @handle-card="handleResult('FAIL')" />
                            </d-col>
                        </d-row>
                        <d-row>
                            <d-col :span="12">
                                <StatisticCard type="EXCEPTION" :count="data.exception_cnt" :active-type="activeType"
                                    @handle-card="handleResult('EXCEPTION')" />
                            </d-col>
                            <d-col :span="12">
                                <StatisticCard type="SKIP" :count="data.skip_cnt" :active-type="activeType"
                                    @handle-card="handleResult('SKIP')" />
                            </d-col>
                        </d-row>
                        <div class="content-title">
                            {{ t('controlFlows.accuracyPassDistributionOverview') }}
                            <PtoButton v-if="selectedBlock" type="text" @click="handleCancelSelect" style="height: 12px;">
                                {{ t('controlFlows.cancelSelection') }}
                            </PtoButton>
                        </div>
                        <div>

                        </div>
                        <div class="overview-blocks" ref="blocksContainerRef">
                            <template v-for="item in overviewList" :key="item.pass_name">
                                <div :class="[
                                    'block',
                                    `block-${item.status}`,
                                    {
                                        'first-error': item?.isFirstFail,
                                        'selected': selectedBlock?.pass_name === item.pass_name,
                                    }
                                ]" @click="handleBlockClick(item)">
                                    <span class="block-number">{{ item.index }}</span>
                                    <span class="block-name" :title="item.pass_name">{{ item.pass_name }}</span>
                                    <span v-if="item?.isFirstFail" class="tag">
                                        <WarningIcon />
                                        <span style="margin-left: 4px;">{{ t('controlFlows.firstError') }}</span>
                                    </span>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
<script setup lang="ts">
import { watch, ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import StatisticCard from '../../comGraph/precisionReport/statisticCard.vue'
import PtoButton from '@/components/ui/PtoButton.vue';
import WarningIcon from '@/components/icons/warning-icon.vue'
const { t } = useI18n();
const props = defineProps({
    modelValue: Boolean,
    data: {
        type: Object,
        default: {
            successPass: [],
            errorPass: [],
            exceptionPass: [],
            skipPass: [],
            pass_cnt: 0,
            fail_cnt: 0,
            exception_cnt: 0,
            skip_cnt: 0
        }
    }
});
const emits = defineEmits(['update:modelValue', 'block-click']);

const drawerEl = ref<HTMLElement | null>(null);
const blocksContainerRef = ref(null)
const dataList = ref([])
const activeType = ref(null)
const selectedBlock = ref(null)

const overviewList = computed(() => {
    if (activeType.value) {
        return dataList.value.filter(item => item?.status === activeType.value);
    } else {
        return dataList.value;
    }
})

const init = () => {
    dataList.value = []
    for (const item of props.data?.successPass ?? []) {
        const splitName = item?.split('_')
        dataList.value.push({ pass_name: splitName?.[2] || '', status: 'PASS', index: Number(splitName?.[1] || '') })
    }
    for (const item of props.data?.errorPass ?? []) {
        const splitName = item?.pass_name?.split('_') || ''
        dataList.value.push({ ...item, status: 'FAIL', index: Number(splitName?.[1] || ''), pass_name: splitName?.[2] })
    }
    for (const item of props.data?.skipPass ?? []) {
        const splitName = item?.split('_')
        dataList.value.push({ pass_name: splitName?.[2] || '', status: 'SKIP', index: Number(splitName?.[1] || '') })
    }
    for (const item of props.data?.exceptionPass ?? []) {
        const splitName = item?.split('_')
        dataList.value.push({ pass_name: splitName?.[2] || '', status: 'EXCEPTION', index: Number(splitName?.[1] || '') })
    }
    dataList.value = dataList.value.sort((a, b) => a.index - b.index)
    let firstFailFound = false; // 标记是否已经找到了第一个 FAIL
    dataList.value.forEach(item => {
        // 检查是否为首错
        const isFirstFail = item?.status === 'FAIL' && !firstFailFound;
        if (isFirstFail) firstFailFound = true;
        item.isFirstFail = isFirstFail
    });
}

watch(() => props.modelValue,
    val => {
        if (val) {
            init()
        }
    })
const handleResult = (type) => {
    activeType.value = activeType.value === type ? null : type
}

// 点击精度pass分布总览，目前只开放'FAIL'
const handleBlockClick = (item) => {
    if (item.status !== 'FAIL') return;
    selectedBlock.value = selectedBlock.value?.pass_name === item.pass_name ? null : item
    emits('block-click', selectedBlock.value)
}

const handleCancelSelect = () => {
    selectedBlock.value = null
    emits('block-click', null)
}

</script>
<style lang="scss" scoped>
@import 'devui-theme/styles-var/devui-var.scss';

.accuracy-report {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 1040;
    width: 490px;
    border-radius: 16px;
    background-color: var(--devui-card-bg);
    box-shadow: -1px 0 0 0 var(--devui-split-line);
    padding: 16px;
    overflow-y: auto;
    scrollbar-gutter: stable;

    .accuracy-report-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 24px;
        box-sizing: content-box;

        .title {
            font-size: 16px;
            font-weight: bold;
            color: var(--devui-title-text);
        }

        .icon-close {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 24px;
            height: 24px;
            color: var(--devui-icon);
            border-radius: 8px;
            transition: background-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth,
                color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
            cursor: pointer;

            &:hover {
                color: var(--devui-title-text);
                background-color: var(--devui-input-hover-bg);
            }
        }
    }

    .accuracy-report-content {
        .title {
            font-size: 14px;
            font-weight: 700;
            margin-top: 16px;
        }

        .content {
            .content-title {
                margin: 8px 0;
                font-size: 12px;
                display: flex;
            }

            .first-name {
                padding: 4px;
                background: rgba(231, 67, 74, 0.2);
                border-radius: 4px;
                width: 100%;
                height: 26px;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                font-size: 13px;
                align-items: center;
                justify-content: center;
            }
        }

    }

    .overview-blocks {
        margin-top: 13px;
        display: flex;
        flex-direction: column;
        gap: 4px;

        .block {
            height: 28px;
            width: 100%;
            border-radius: 8px;
            font-size: 13px;
            padding: 4px;
            border: 1px solid transparent;
            display: flex;

            &.block-PASS {
                border-left-color: rgba(135, 200, 89, 1);
                background: rgba(135, 200, 89, 0.02);

                .block-number {
                    color: rgba(135, 200, 89, 1);
                    width: 20px;
                    height: 20px;
                    border-radius: 6px;
                    background: rgba(135, 200, 89, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 6px;
                    padding: 0 0 4px 0;
                }
                .block-name {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                &:hover {
                    border-color: rgba(135, 200, 89, 1);
                }
            }

            &.block-FAIL {
                border-left-color: rgba(231, 67, 74, 1);
                background: rgba(231, 67, 74, 0.02);

                .block-number {
                    color: rgba(231, 67, 74, 1);
                    width: 20px;
                    height: 20px;
                    border-radius: 6px;
                    background: rgba(231, 67, 74, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 6px;
                    padding: 0 0 4px 0;
                }
                .block-name {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                &:hover {
                    border-color: rgba(199, 91, 96, 1);
                }

                &.selected {
                    border-color: rgba(199, 91, 96, 1);
                }

                .tag {
                    margin-left: auto;
                    display: flex;
                    background-color: rgba(231, 67, 74, 0.1);
                    border-radius: 4px;
                    height: 20px;
                    justify-content: center;
                    align-items: center;
                    padding: 0 8px;
                    color: rgba(231, 67, 74, 1);
                }
            }

            &.block-SKIP {
                border-left-color: rgba(153, 153, 153, 1);
                background: rgba(153, 153, 153, 0.02);

                .block-number {
                    color: rgba(153, 153, 153, 1);
                    width: 20px;
                    height: 20px;
                    border-radius: 6px;
                    background: rgba(153, 153, 153, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 6px;
                    padding: 0 0 4px 0;
                }
                .block-name {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                &:hover {
                    border-color: rgba(153, 153, 153, 1);
                }

                &.selected {
                    border-color: rgba(153, 153, 153, 1);
                }
            }

            &.block-EXCEPTION {
                border-left-color: rgba(246, 158, 57, 1);
                background: rgba(246, 158, 57, 0.02);

                .block-number {
                    color: rgba(246, 158, 57, 1);
                    width: 20px;
                    height: 20px;
                    border-radius: 6px;
                    background: rgba(246, 158, 57, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 6px;
                    padding: 0 0 4px 0;
                }
                .block-name {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                &:hover {
                    border-color: rgba(246, 158, 57, 1);
                }

                &.selected {
                    border-color: rgba(246, 158, 57, 1);
                }
            }

            &.first-error {
                background: rgba(231, 67, 74, 0.16);

                .block-number {
                    color: var(--devui-text);
                    width: 20px;
                    height: 20px;
                    border-radius: 6px;
                    background: rgba(231, 67, 74, 1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 6px;
                    padding-bottom: 1px;
                }
            }
        }
    }
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
    transition: transform 0.3s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
    transform: translate(100%);
}
</style>