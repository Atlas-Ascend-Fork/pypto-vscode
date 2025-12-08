<template>
  <div v-if="isCfgEditing" class="cfgEdit">
    <div class="cfg-content">
        <div class="cfg-head">
            <div class="cfg-title"> {{ $t('swimRenderCfg') }} </div>
            <div class="cfg-close-button">
                <d-button icon="icon-close" style="border:none; background-color: transparent" @click="togglecfgEditModel"></d-button>
            </div>
        </div>
        <div class="cfg-Shading-mode">
            <div class="cfg-Shading-mode-t">{{ $t('shadingMode') }} </div>
            <d-select v-model="modeOption" :options="modeOptions" size="sm" @update:modelValue="OnModeChange" :disabled=isThreeColumn></d-select>
        </div>
        <div class="task-content">
            <div class="task-content-t">{{ $t('eventTask') }} </div>
            <d-select :class="[textOption.length === 1 && 'singleOption']" :menu-class="[textOption.length === 1 && 'singleOptionMenu']" v-model="textOption" :options="textOptions" :multiple="true" size="sm" @update:modelValue="OnTextChange" :multiple-limit="2" option-disabled-key="disabled"></d-select>
        </div>
        <div class="cfg-line"></div>
        <div class="task-connection-level">
            <div class="cfg-head">
                <div class="task-connection-level-t mb6">{{ $t('taskConnectionLevel') }}</div>
                <d-tooltip :content="$t('connectionLevel')">
                    <d-icon name="icon-helping" class="help-font"></d-icon>
                </d-tooltip>
            </div>
            <d-input-number class="connection-level-input" v-model="connectionLevel" :step="1" :precision="0" :min="-1" @change="onInputChange"></d-input-number>
        </div>
    </div>
  </div>
</template>
<script setup>
import { ref, inject, watch, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getEventColorByMode } from '../swimGraphProcesses/processInfo';
import { useViewServer } from '../../../core/use-view-server';

const { server } = useViewServer();
const { t: $t } = useI18n();
const {
    processes,
    isCfgEditing,
    childContextMap,
    timelineState,
    isThreeColumn,
} = inject('swimGraphState');

const {
  transform,
  postMessage,
  getDisplayName,
} = inject('swimGraphMethods');

const {
  userConfig,
  textOption,
  modeOption,
} = inject('swimGraphCfg');

const connectionLevel = computed({
  get: () => userConfig.get('connectionLevel') ?? -1,
  set: (value) => {
    userConfig.set('connectionLevel', value);
  }
});

const shadingOp = [
    {name: $t('colorRendering'), value: 'colorRendering', disabled: true},
];

const shadingOptions = reactive(shadingOp);
const shadingOption = ref('colorRendering');

const modeOp = [
    {name: $t('subGraph'), value: 'subGraph'},
    {name: $t('stichedFunc'), value: 'stichedFunc'},
    {name: $t('label'), value: 'label'},
];

const modeOptions = reactive(modeOp);
const textOp = [
    {name: $t('taskName'), value: 'taskName', disabled: false},
    {name: $t('taskLabel'), value: 'taskLabel', disabled: false},
];
const textOptions = reactive(textOp);

const togglecfgEditModel = () => {
    if (isCfgEditing.value) {
        isCfgEditing.value = !isCfgEditing.value;
    }
};

function saveRendingMode(colorRenderMode, textRenderMode) {
    server.saveRendingMode({paramObj: JSON.stringify({ colorRending: colorRenderMode, textRending: textRenderMode})});
};

function changeUserCfgConnection(connectionLevelInfo) {
    server.changeUserCfgConnection({paramObj: {level: connectionLevelInfo}});
};

const OnTextChange = (value) => {
    const updateEventText = (mode) => {
        for (const process of processes.values()) {
            for (const thread of process.threads.values()) {
                for (const event of thread.events) {
                    if (!event.isCounter) {
                        event.drawData.text = mode === 'allText' ? event.name : getDisplayName(event);
                    }
                }
            }
        }
    };
    if (textOption.value.length === 1) {
        const [selectedTextOption] = textOption.value;
        updateEventText(selectedTextOption);
    } else if (textOption.value.length === 2) {
        updateEventText('allText');
    }
    transform();
    saveRendingMode(modeOption.value, textOption.value);
};

const OnModeChange = () => {
    const updateEventColor = (event, mode) => {
        const color = getEventColorByMode(event, mode);
        event.color = color;
        const { fillColor, fontColor, strokeColor } = childContextMap.threadEvent.getEventColor(event, event.renderInfo.processKey);
        event.drawData.rectColor = fillColor;
        event.drawData.strokeColor = strokeColor;
        event.drawData.fontColor = fontColor;
    };
    const updateEvents = (mode) => {
        for (const process of processes.values()) {
            for (const thread of process.threads.values()) {
                for (const event of thread.events) {
                    if (!event.isCounter && event.endTime >= timelineState.startTime && event.startTime <= timelineState.endTime) {
                        updateEventColor(event, mode);
                    }
                }
            }
        }
    };
    if (modeOption.value === 'subGraph') {
        updateEvents('subGraph');
    } else if (modeOption.value === 'stichedFunc') {
        updateEvents('stichedFunc');
    } else if (modeOption.value === 'label') {
        updateEvents('label');
    } else {
        return; 
    }
    transform();
    saveRendingMode(modeOption.value, textOption.value);
};

const onInputChange = (newValue) => {
    userConfig.value.connectionLevel = newValue;
    transform();
    changeUserCfgConnection(newValue);
};
// 暴露方法给父组件
defineExpose({
  connectionLevel
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
</style>