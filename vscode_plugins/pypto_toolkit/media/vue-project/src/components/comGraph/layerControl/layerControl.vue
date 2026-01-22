<template>
  <Teleport to="body">
    <div v-if="modelValue" ref="rootEl" class="layer-control-container" :style="styles">
      <div ref="dragEl" class="drag-area">
        <em class="icon icon-drag"></em>
        <em class="icon icon-drag"></em>
      </div>
      <div class="content-wrap">
        <div class="header">
          <span class="title">{{ t('comGraph.layerControl') }}</span>
          <em class="icon icon-close" @click="() => emits('update:modelValue', false)"></em>
        </div>
        <div class="graph-layout mb-16">
          <div class="title mb-8">{{ t('comGraph.graphLayout') }}</div>
          <d-tabs
            v-model="graphLayout"
            type="slider"
            :show-content="false"
            class="layer-control-tabs"
            @update:modelValue="(e) => emits('graphLayoutChange', e)"
          >
            <d-tab id="RIGHT" :disabled="tabDisable">
              <template #title>
                <em class="icon icon-b-tree left-right" />
                <span class="ml-4">{{ t('comGraph.leftRight') }}</span>
              </template>
            </d-tab>
            <d-tab id="DOWN" :disabled="tabDisable">
              <template #title>
                <em class="icon icon-b-tree" />
                <span class="ml-4">{{ t('comGraph.topBottom') }}</span>
              </template>
            </d-tab>
          </d-tabs>
        </div>
        <div class="node-display-mode">
          <div class="title mb-8">{{ t('comGraph.nodeDisplayMode') }}</div>
          <d-tabs
            v-model="nodeDisplayMode"
            type="slider"
            :show-content="false"
            class="layer-control-tabs"
            @update:modelValue="(e) => emits('nodeDisplayChange', e)"
          >
            <d-tab id="all" title="Tensor + OP" :disabled="tabDisable"></d-tab>
            <d-tab id="op" title="OP" :disabled="tabDisable"></d-tab>
          </d-tabs>
        </div>
        <div class="node-display-mode node_cont">
          <div class="title mb-8">{{ t('comGraph.nodesControl') }}</div>
          <d-select class="mb-2" style="height: 48px; max-height: 48px;" v-model="selectedValues" :options="textOptions" :multiple="true" @value-change="OnTextChange" :placeholder="t('comGraph.nodeShowAll')"/>
        </div>
        <div class="node-display-mode" v-if="props.openMode === 'path'">
          <div class="title mb-8">{{ t('comGraph.nodeSearchLevel') }}</div>
              <d-input-number v-model="linkLevel" :step="1" :precision="0" :min="-1" class="input-number-container" @change="onInputChange"/>
              <d-tooltip>
                <d-icon name="icon-helping" class="help-font"></d-icon>
                <template #content>
                    <div class="icon-help-tip"> {{t('comGraph.nodeSearchLevelTips1')}} <br> {{t('comGraph.nodeSearchLevelTips2')}} </div>
                </template>
              </d-tooltip>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMoveable } from './use-moveable';
import { comGraphStore } from '../../../service/com-graph-store';
import { vscode } from '../../../core/vscode';

const textOptions = ref([
  "shape",
  "rawshape",
  "offset",
  "datatype",
]);

const emits = defineEmits(['update:modelValue', 'graphLayoutChange', 'nodeDisplayChange', 'selectNodesChange', 'nodeSearchLevelChange']);

const selectedValues = ref([]);
const selectedIndexes = computed(()=>{
  return selectedValues.value.map(value =>{
    return textOptions.value.indexOf(value);
  });
});

const OnTextChange = (val) => {
  comGraphStore.setData("selectCustom", selectedIndexes.value);
  emits('selectNodesChange', val);
}

const tabDisable = computed(() => {
  const disabledFlag = comGraphStore.data.inFixedComGraphFlow || 
                       (comGraphStore.data?.pathNodesSet && (comGraphStore.data.pathNodesSet.size > 0));
  return disabledFlag;
})

const defaultSearchLevel = computed(() => comGraphStore.data?.searchLevel ?? -1);

const onInputChange = (newValue) => {
  linkLevel.value = newValue;
  emits('nodeSearchLevelChange', linkLevel.value);
}

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  openMode: {
  type: String,
  default: 'all'
},
});

const { t } = useI18n();
const { dragEl, rootEl, styles } = useMoveable(props);
const graphLayout = ref('RIGHT');
const nodeDisplayMode = ref('all');
const linkLevel = ref<number>(Number(defaultSearchLevel.value));
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.layer-control-container {
  position: fixed;
  z-index: 1040;
  width: 280px;
  color: var(--devui-primary-text);
  border-radius: 8px;
  background-color: var(--devui-select-bg);
  box-shadow: 0 0 16px 0 var(--devui-select-shadow);

  .drag-area {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 16px;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    background-color: var(--devui-nest-bg);
    cursor: move;

    .icon-drag {
      transform: rotate(90deg);

      &:nth-of-type(2) {
        margin-left: -1px;
      }
    }
  }

  .content-wrap {
    width: 100%;
    padding: 16px;
    box-sizing: border-box;

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      .title {
        font-size: 16px;
        font-weight: bold;
        line-height: 24px;
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
  }
}

.layer-control-tabs.devui-tabs {
  :deep() {
    .devui-tabs__nav--slider {
      width: 100%;
      background-color: var(--devui-tab-bg);

      li {
        flex: 1;

        .devui-tabs__nav-content {
          justify-content: center;
        }

        a {
          color: var(--devui-secondary-text);
          padding: 0 10px;
          white-space: nowrap;
        }

        &:hover a {
          color: var(--devui-secondary-text);
        }
      }

      li.active a {
        color: var(--devui-primary-text);
      }
    }
    .devui-tabs__nav-slider-animation {
      background-color: var(--devui-flow-water-bg);
    }
  }
}

.icon-b-tree.left-right {
  transform: rotate(-90deg);
}

.mb-8 {
  margin-bottom: 8px;
}
.mb-16 {
  margin-bottom: 16px;
}
.ml-4 {
  margin-left: 4px;
}
.node_cont {
  margin-top: 16px;
}
:deep(.devui-select__selection) {
  max-height: 48px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: 0px;
  align-items: stretch !important;

  &::-webkit-scrollbar {
    width: 0;
  }
}

.list-menu {
  padding: 0;
  margin: 0;
  width: 100%;
}

.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 4px;
  cursor: pointer;
}

.menu-item:hover {
  background-color: var(--devui-list-item-hover-bg, #e1e2e2);
  color: var(--devui-list-item-hover-text, #7a7a7a);
}

.icon-help-tip {
  color: #b3b3b3; 
  font-size: 12px; 
  font-weight: 400; 
  line-height: 16px;
  padding: 4px 4px 4px 4px;
  margin-bottom: 6px !important;
}

.input-number-container {
  height: 28px;

  :deep(.devui-input-number .disabled) {
    cursor: default;
  }
}

  .input-number-container.locked-style {
    background-color: var(--devui-input-bg) !important;
    height: 28px;
    border-color: transparent;
    input {
      background-color: transparent !important;
      border-color: transparent;
    }
  }



</style>
