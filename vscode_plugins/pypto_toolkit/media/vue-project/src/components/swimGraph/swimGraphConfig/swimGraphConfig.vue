<template>
  <div v-if="isCfgEditing" class="cfgEdit">
    <div class="cfg-content">
        <div class="cfg-head">
            <div class="cfg-title"> {{ $t('swimRenderCfg') }} </div>
            <div class="cfg-close-button">
                <d-button icon="icon-close" style="border:none; background-color: transparent" @click="togglecfgEditModel"></d-button>
            </div>
        </div>
        <div class="cfg-select">
            <d-select v-model="shadingOption" :options="shadingOptions" option-disabled-key="disabled" :placeholder="$t('colorRendering')" size="sm"></d-select>
        </div>
        <div class="cfg-Shading-mode">
            <div class="cfg-Shading-mode-t">{{ $t('shadingMode') }} </div>
            <d-select v-model="modeOption" :options="modeOptions" size="sm" @update:modelValue="OnModeChange"></d-select>
        </div>
        <div class="task-content">
            <div class="task-content-t">{{ $t('eventTask') }} </div>
            <d-select v-model="textOption" :options="textOptions" :multiple="true" size="sm" @update:modelValue="OnTextChange" :multiple-limit="2" option-disabled-key="disabled"></d-select>
        </div>
        <div class="cfg-line"></div>
        <div class="task-connection-level">
            <div class="task-connection-level-t">{{ $t('taskConnectionLevel') }}</div>
            <div class="task-connection-level-tip"> {{ $t('connectionLevel') }}</div>
            <d-input-number class="connection-level-input" v-model="connectionLevelCfg" :step="1" :precision="0" :min="-1" @change="onInputChange"></d-input-number>
        </div>
    </div>
  </div>
</template>
<script setup>
import { ref, inject, watch, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { getEventColor } from '../swimGraphProcesses/processInfo';
const { t: $t } = useI18n();
const {
    processes,
    isCfgEditing,
    childContextMap,
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
  connectionLevelCfg
} = inject('swimGraphCfg');

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
    postMessage({ command: 'saveRendingMode', paramObj: JSON.stringify({ colorRending: colorRenderMode, textRending: textRenderMode})});
}

function changeUserCfgConnection(connectionLevel) {
    postMessage({ command: 'changeUserCfgConnection', paramObj: {level: connectionLevel}});
}


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
        const color = getEventColor(event, mode);
        event.color = color;
        const { fillColor, fontColor, strokeColor } = childContextMap.threadEvent.getEventColor(event);
        event.drawData.rectColor = fillColor;
        event.drawData.strokeColor = strokeColor;
        event.drawData.fontColor = fontColor;
    };
    const updateEvents = (mode) => {
        for (const process of processes.values()) {
            for (const thread of process.threads.values()) {
                for (const event of thread.events) {
                    if (!event.isCounter) {
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
    connectionLevelCfg.value = newValue;
    userConfig.value.connectionLevel = newValue;
    transform();
    changeUserCfgConnection(newValue);
};
</script>

<style lang="scss">
@import url("../css/swimGraph/Config/config.css");
.cfg-select {
    width: 160px;
    .devui-select__selection {
        background-color: transparent !important;
        border: none !important;
        input:focus {
            outline: none;
        }
        .devui-select__input {
            padding: 0;
            background-color: transparent !important;
        }
    }
}

.cfg-Shading-mode {
    .devui-select__selection {
        background-color: var(--devui-input-bg) !important;
        border: none !important;
        input:focus {
            outline: none;
        }
    }
}

.task-content {
    .devui-select__selection {
        background-color: var(--devui-input-bg) !important;
        border: none !important;
        input:focus {
            outline: none;
        }
        .devui-select__multiple {
            height: 24px;
        }
    }
}

.task-connection-level {
    .devui-input-number {
        background-color: var(--devui-input-bg) !important;
        input {
            background-color: var(--devui-input-bg) !important;
            outline: none !important;
        }
    }
}
</style>