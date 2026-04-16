<template>
  <div v-if="isCfgEditing" id="cfgEdit" class="cfgEdit" :style="{ top: isThreeColumn ? '0px': '60px'}">
    <div class="cfg-content">
        <div class="cfg-head">
            <div class="cfg-title"> {{ $t('swimRenderCfg') }} </div>
            <div class="cfg-close-button">
                <d-button icon="icon-close" style="border:none; background-color: transparent" @click="togglecfgEditModel"></d-button>
            </div>
        </div>
        
        <div class="cfg-section">
            <div class="cfg-line"></div>
            <div class="cfg-section-title">{{ $t('globalConfig') }}</div>
            <div class="task-connection-level">
                <div class="cfg-head">
                    <div class="task-connection-level-t mb6">{{ $t('taskConnectionLevel') }}</div>
                    <d-tooltip :content="$t('connectionLevel')">
                        <d-icon name="icon-helping" class="help-font"></d-icon>
                    </d-tooltip>
                </div>
                <d-input-number class="connection-level-input" :class="{'locked-style': isPathLockStatus}" v-model="connectionLevel" :disabled=isPathLockStatus :step="1" :precision="0" :min="-1" @change="onInputChange"></d-input-number>
            </div>
            <div class="performance-panel-config">
                <div class="cfg-head">
                    <div class="performance-panel-config-t mb6">{{ $t('showPerformancePanel') }}</div>
                    <d-tooltip :content="$t('showPerformancePanelTip')">
                        <d-icon name="icon-helping" class="help-font"></d-icon>
                    </d-tooltip>
                </div>
                <d-switch v-model="showPerformancePanel" @change="onPerformanceChange"></d-switch>
            </div>
        </div>

        <div class="cfg-section" v-if="showAicpuConfig">
            <div class="cfg-line"></div>
            <div class="cfg-section-title">{{ $t('aicpuConfig') }}</div>
            <div class="cfg-Shading-mode">
                <div class="cfg-Shading-mode-t">{{ $t('shadingMode') }} </div>
                <d-select v-model="aicpuModeOption" :options="aicpuModeOptions" size="sm" @update:modelValue="OnAicpuModeChange"></d-select>
            </div>
        </div>

        <div class="cfg-section" v-if="showPerfConfig">
            <div class="cfg-line"></div>
            <div class="cfg-section-title">{{ $t('pypto3Config') }}</div>
            <div class="cfg-Shading-mode">
                <div class="cfg-Shading-mode-t">{{ $t('shadingMode') }} </div>
                <d-select v-model="perfModeOption" :options="perfModeOptions" size="sm" @update:modelValue="OnPerfModeChange"></d-select>
            </div>
        </div>

        <div class="cfg-section" v-if="showKernelConfig">
            <div class="cfg-line"></div>
            <div class="cfg-section-title">{{ $t('kernelConfig') }}</div>
            <div class="cfg-Shading-mode">
                <div class="cfg-Shading-mode-t">{{ $t('shadingMode') }} </div>
                <d-select v-model="kernelModeOption" :options="kernelModeOptions" size="sm" @update:modelValue="OnKernelModeChange"></d-select>
            </div>
            <div class="task-content">
                <div class="task-content-t">{{ $t('eventTask') }} </div>
                <d-select :class="[kernelTextOption.length === 1 && 'singleOption']" :menu-class="kernelTextOption.length === 1 ? 'singleOptionMenu' : ''" v-model="kernelTextOption" :options="kernelTextOptions" :multiple="true" size="sm" @update:modelValue="OnKernelTextChange" :multiple-limit="2" option-disabled-key="disabled"></d-select>
            </div>
        </div>
    </div>
  </div>
</template>
<script setup>
import { ref, inject, watch, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getEventColorByMode } from '../swimGraphProcesses/processInfo';
import { useViewServer } from '../../../core/use-view-server';
import { COLOR_CFG, DEP_MODE } from '../swimGraphUtils';
const { isDarkTheme } = inject('root');

let colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
const { server } = useViewServer();
const { t: $t } = useI18n();
const {
    processes,
    isCfgEditing,
    childContextMap,
    timelineState,
    isThreeColumn,
    isPathLockStatus,
    isAicpu,
    isMixedAicpuKernel,
    isPerfSwim
} = inject('swimGraphState');

const {
  transform,
  postMessage,
  getDisplayName,
} = inject('swimGraphMethods');

const { pinnedThreadsList } = inject('swimGraphPinnedState');

const {
  userConfig,
} = inject('swimGraphCfg');

const connectionLevel = computed({
  get: () => userConfig.get('connectionLevel') ?? -1,
  set: (value) => {
    userConfig.set('connectionLevel', value);
  }
});

const showPerformancePanel = computed({
  get: () => userConfig.get('showPerformancePanel') ?? true,
  set: (value) => {
    userConfig.set('showPerformancePanel', value);
  }
});

const showAicpuConfig = computed(() => {
  return isAicpu.value || isMixedAicpuKernel.value;
});

const showPerfConfig = computed(() => {
  return isPerfSwim.value;
});

const showKernelConfig = computed(() => {
  return !isAicpu.value && !isPerfSwim.value;
});

const aicpuModeOptions = computed(() => {
  return [{name: $t('name'), value: 'name'}];
});

const perfModeOptions = computed(() => {
  return [{name: $t('name'), value: 'perfName'}];
});

const aicpuModeOption = ref('name');

const perfModeOption = ref('perfName');

const kernelModeOptions = computed(() => {
  if (isThreeColumn) {
    return [
        {name: $t('label'), value: 'label'},
    ];
  }
  return [
    {name: $t('subGraph'), value: 'subGraph'},
    {name: $t('stichedFunc'), value: 'stichedFunc'},
    {name: $t('label'), value: 'label'},
    {name: $t('mixSubGraph'), value: 'mixSubGraph'},
  ];
});

const kernelModeOption = ref(isThreeColumn ? 'label' : 'subGraph');

const kernelTextOptions = computed(() => [
  {name: $t('taskName'), value: 'taskName', disabled: false},
  {name: $t('taskLabel'), value: 'taskLabel', disabled: false},
]);

const kernelTextOption = ref(['taskName', 'taskLabel']);

const togglecfgEditModel = () => {
    if (isCfgEditing.value) {
        isCfgEditing.value = !isCfgEditing.value;
    }
};

function changeUserCfgConnection(connectionLevelInfo) {
    server.changeUserCfgConnection({paramObj: {level: connectionLevelInfo}});
};

const configGetEventColor = (colorEvent, mode) => {
    const color = getEventColorByMode(colorEvent, mode);
    colorEvent.color = color;
    const eventColor = isDarkTheme.value ? colorEvent.color.dark : colorEvent.color.light;
    let fillColor = eventColor ? eventColor.base : '';
    let fontColor = colorCfg.eventFont;
    let strokeColor = '';

    const colors = { fillColor, fontColor, strokeColor };
    return colors;
};

const updateAicpuEvents = (mode) => {
    for (const process of processes.values()) {
        if (process.type !== 'aicpu' || !process.isRendered) {
            continue;
        }
        for (const thread of process.threads.values()) {
            for (const event of thread.events) {
                if (!event.isCounter && event.endTime >= timelineState.startTime && event.startTime <= timelineState.endTime) {
                    const color = getEventColorByMode(event, mode);
                    event.color = color;
                    const { fillColor, fontColor, strokeColor } = configGetEventColor(event, mode);
                    event.drawData.rectColor = fillColor;
                    event.drawData.strokeColor = strokeColor;
                    event.drawData.fontColor = fontColor;
                }
            }
        }
    }
};

const OnAicpuModeChange = () => {
    updateAicpuEvents(aicpuModeOption.value);
    transform();
    saveAicpuRendingMode(aicpuModeOption.value);
};

function saveAicpuRendingMode(colorRenderMode) {
    server.saveRendingMode({paramObj: JSON.stringify({ aicpuColorRending: colorRenderMode })});
};

const updatePerfEvents = (mode) => {
    for (const process of processes.values()) {
        if (!process.isRendered) {
            continue;
        }
        for (const thread of process.threads.values()) {
            for (const event of thread.events) {
                if (!event.isCounter && event.endTime >= timelineState.startTime && event.startTime <= timelineState.endTime) {
                    const color = getEventColorByMode(event, mode);
                    event.color = color;
                    const { fillColor, fontColor, strokeColor } = configGetEventColor(event, mode);
                    event.drawData.rectColor = fillColor;
                    event.drawData.strokeColor = strokeColor;
                    event.drawData.fontColor = fontColor;
                }
            }
        }
    }
};

const OnPerfModeChange = () => {
    updatePerfEvents(perfModeOption.value);
    transform();
    savePerfRendingMode(perfModeOption.value); 
};

function savePerfRendingMode(colorRenderMode) {
    server.saveRendingMode({paramObj: JSON.stringify({ perfColorReding: colorRenderMode })});
};

const updateKernelEvents = (mode) => {
    const {startTime, endTime} = timelineState;
    const updateEventColors = (event) => {
        if (!event.isCounter && event.endTime >= startTime && event.startTime <= endTime) {
            const color = getEventColorByMode(event, mode);
            event.color = color;
            const { fillColor, fontColor, strokeColor } = configGetEventColor(event, mode);
            event.drawData.rectColor = fillColor;
            event.drawData.strokeColor = strokeColor;
            event.drawData.fontColor = fontColor;
        }
    };
    pinnedThreadsList.value.filter(pinThread => pinThread.process.type === 'kernel')
    .forEach((pinThread) => {
        pinThread.thread.events.forEach(updateEventColors);
    });
    for (const process of processes.values()) {
        if (process.type === 'aicpu' || !process.isRendered) {
            continue;
        }
        process.threads.forEach((thread) => {
            thread.events.forEach(updateEventColors);
        });
    }
};

const OnKernelModeChange = (mode) => {
    userConfig.value.kernelColorRending = mode;
    updateKernelEvents(kernelModeOption.value);
    transform();
    saveKernelRendingMode(kernelModeOption.value, kernelTextOption.value);
};

const OnKernelTextChange = (value) => {
    userConfig.value.kernelTextRending = value;
    transform();
    saveKernelRendingMode(kernelModeOption.value, kernelTextOption.value);
};

function saveKernelRendingMode(colorRenderMode, textRenderMode) {
    server.saveRendingMode({paramObj: JSON.stringify({ kernelColorRending: colorRenderMode, kernelTextRending: textRenderMode })});
};

const onInputChange = (newValue) => {
    userConfig.value.connectionLevel = newValue;
    transform();
    changeUserCfgConnection(newValue);
};

const onPerformanceChange = (newValue) => {
    if (userConfig.value) {
        userConfig.value.showPerformancePanel = newValue;
    }
    userConfig.set('showPerformancePanel', newValue);
    server.changeUserCfgPerformance({paramObj: {show: newValue}});
};
defineExpose({
  connectionLevel,
  showPerformancePanel
});

watch(userConfig, () => {
    aicpuModeOption.value = userConfig.value.aicpuColorRending;
    perfModeOption.value = userConfig.value.perfColorReding;
    kernelModeOption.value = userConfig.value.kernelColorRending;
    kernelTextOption.value = userConfig.value.kernelTextRending;
});
</script>

<style lang="scss">
@import url("../css/swimGraph/Config/config.css");
.cfg-Shading-mode {
    .devui-select:not(.devui-select--disabled):not(.devui-select--underlined) .devui-select__selection.devui-select__selection--glow-style:hover {
        border-color: var(--devui-select-hover-border-color);
    }
    .devui-select--open .devui-select__selection.devui-select__selection--glow-style {
        border-color: var(--devui-select-active-border-color) !important;
    }

    .devui-select__selection {
        height: 28px;
        background-color: var(--devui-input-bg);
        border-color: transparent;
        input {
            display:flex;
            align-items: center;
        }
    }
    .devui-select--disabled .devui-select__selection {
        background-color: var(--devui-input-disabled-bg);
        border-color: transparent;
    }
}

.task-content {
    .devui-select:not(.devui-select--disabled):not(.devui-select--underlined) .devui-select__selection.devui-select__selection--glow-style:hover {
        border-color: var(--devui-select-hover-border-color);
    }
    .devui-select--open .devui-select__selection.devui-select__selection--glow-style {
        border-color: var(--devui-select-active-border-color) !important;
    }
    .devui-select__selection {
        height: 28px;
        background-color: var(--devui-input-bg) !important;
        border-color: transparent;
        .devui-select__multiple {
            height: 20px;
        }
    }
}

.task-connection-level {
    .devui-input-number.devui-input-number--glow-style:hover {
        border-color: var(--devui-select-hover-border-color);
    }
    .devui-input-number.devui-input-number--glow-style:focus-within .devui-input-number__input-box:not(.disabled) {
        border-color: var(--devui-select-active-border-color);
    }
    .devui-input-number {
        background-color: var(--devui-input-bg) !important;
        height: 28px;
        border-color: transparent;
        input {
            background-color: var(--devui-input-bg) !important;
            border-color: transparent;
        }
    }
    .devui-input-number.locked-style {
        background-color: var(--devui-input-bg) !important;
        height: 28px;
        border-color: transparent;
        input {
            background-color: transparent !important;
            border-color: transparent;
        }
    }
}
.connection-level-input .devui-input-number__control-buttons .control-button.control-dec svg {
    bottom: 0;
}
.connection-level-input .devui-input-number__control-buttons .control-button.control-inc svg {
    top: 0;
}
.singleOption a {
    pointer-events: none;
}

.singleOptionMenu {
    .active {
        pointer-events: none;
    }
}

.devui-switch--checked:hover {
    background: var(--devui-brand) !important;
    border-color: var(--devui-brand) !important;
}
</style>