<template>
  <d-dropdown
    :visible="isOpen"
    trigger="manually"
    :position="['bottom-start']"
    :offset="10"
    close-scope="blank"
    class="pass-list-menu-wrap"
    @toggle="onToggle"
  >
    <div class="pass-list-container" @click="isOpen = !isOpen">
      <div :class="['pass-type', currentData?.passStage]">{{ currentData?.passStage ? UpperFirstStr(currentData?.passStage) : '' }}</div>
      <div>
        <div class="pass-content">{{ currentData?.passIndex }} {{ currentData?.passName }}</div>
        <div class="dot-step">
          <ThreeDot :dot-color="isMiddleGraph(PassStage.TENSOR_GRAPH) ? '#fde55c' : 'var(--devui-split-line)'" />
          <span :class="['big-dot', isLastGraph(PassStage.TENSOR_GRAPH) && 'last-tensor']"></span>
          <ThreeDot :dot-color="isMiddleGraph(PassStage.TILE_GRAPH) ? '#7ddfe7' : 'var(--devui-split-line)'" />
          <span :class="['big-dot', isLastGraph(PassStage.TILE_GRAPH) && 'last-tile']"></span>
          <ThreeDot :dot-color="isMiddleGraph(PassStage.BLOCK_GRAPH) ? '#63d5a8' : 'var(--devui-split-line)'" />
          <span :class="['big-dot', isLastGraph(PassStage.BLOCK_GRAPH) && 'last-block']"></span>
        </div>
      </div>
    </div>
    <template #menu>
      <d-search
        is-keyup-search
        icon-position="left"
        :placeholder="`${t('comGraph.search')}pass`"
        :show-glow-style="false"
        class="pass-list-search"
        @click.stop
        @search="(e) => (filterKey = e)"
      ></d-search>
      <div style="max-height: 400px; overflow: auto">
        <div v-for="item in Object.keys(renderPassList)" :key="item" class="pass-list-item-stage">
          <div :class="[item]">{{ UpperFirstStr(item) }} Graph</div>
          <div
            v-for="pass in renderPassList[item]"
            :key="pass.passIndex"
            :class="['pass-list-item', pass.passIndex === currentData?.passIndex && 'active']"
            @click="() => selectPass(pass)"
          >
            <span>{{ pass.passIndex }}</span>
            <span :title="pass.passName">{{ pass.passName }}</span>
            <d-icon v-if="pass.hasHealthReport" name="icon-line-chart" color="var(--devui-status-success-text)" size="14px"></d-icon>
          </div>
        </div>
        <div v-if="!Object.keys(renderPassList).length" class="search-no-res">{{ t('noDataMatched') }}</div>
      </div>
    </template>
  </d-dropdown>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ThreeDot from './threeDot.vue';
import { transformPassList, UpperFirstStr } from './util';
import { NavbarContext, NavbarProvideKey } from './navbar-types';
import { PassStage } from '../../../../../src/types/workspace/pass';
import type { PathInPass } from '../../../../../src/types/control-flow';

const { t } = useI18n();
const { rootProps, passList, leafFunctions, jumpComGraph } = inject(NavbarProvideKey) as NavbarContext;
const filterKey = ref('');
const isOpen = ref(false);
const currentData = ref<PathInPass>();
let PassListMap: Partial<Record<PathInPass['passStage'], PathInPass[]>> = {};

const renderPassList = computed(() => {
  if (!filterKey.value) {
    return transformPassList(passList.value);
  } else {
    return transformPassList(
      passList.value.filter((item) => item.passName.toLocaleLowerCase().includes(filterKey.value.toLocaleLowerCase())),
    );
  }
});

watch(
  passList,
  (val) => {
    if (val) {
      PassListMap = transformPassList(val);
      updateCurrentData();
    }
  },
  { immediate: true },
);

watch(
  () => rootProps.currentPassIndex,
  () => {
    updateCurrentData();
  },
  { immediate: true },
);

function updateCurrentData() {
  if (rootProps.currentPassIndex && passList.value.length) {
    for (let i = 0; i < passList.value.length; i++) {
      const item = passList.value[i];
      if (parseInt(item.passIndex) === parseInt(rootProps.currentPassIndex)) {
        currentData.value = item;
        leafFunctions.value = item.leafFunctions;
      }
    }
  }
}

function onToggle(val: boolean) {
  isOpen.value = val;
  filterKey.value = '';
}

function selectPass(pass: PathInPass) {
  isOpen.value = false;
  jumpComGraph(pass.graphFilePath, pass.pathName);
}

function isLastGraph(passStage: PathInPass['passStage']) {
  const temp = PassListMap[passStage];
  if (temp?.length && currentData.value) {
    return currentData.value.passIndex === temp[temp.length - 1].passIndex;
  }
}

function isMiddleGraph(passStage: PathInPass['passStage']) {
  const temp = PassListMap[passStage];
  if (temp?.length && currentData.value && currentData.value.passStage === passStage) {
    return currentData.value.passIndex !== temp[temp.length - 1].passIndex;
  }
}

defineExpose({ getCurrentPass: () => currentData.value });
</script>

<style scoped lang="scss">
.pass-list-container {
  display: flex;
  gap: 4px;
  cursor: pointer;

  .pass-type {
    height: 16px;
    line-height: 16px;
    font-size: 10px;
    padding: 0 4px;
    border-radius: 16px;
    text-align: center;
    box-sizing: border-box;

    &.block {
      color: #63d5a8;
      background-color: #058358;
    }
    &.tile {
      color: #7ddfe7;
      background-color: #1c94a4;
    }
    &.tensor {
      color: #fde55c;
      background-color: #d19f00;
    }
  }

  .pass-content {
    line-height: 16px;
    font-size: 10px;
    color: var(--devui-title-text);
    margin-bottom: 2px;
  }

  .dot-step {
    display: flex;
    align-items: center;
    gap: 2px;

    .big-dot {
      width: 6px;
      height: 6px;
      border-radius: 6px;
      background-color: var(--devui-split-line);

      &.last-block {
        background-color: #63d5a8;
      }
      &.last-tile {
        background-color: #7ddfe7;
      }
      &.last-tensor {
        background-color: #fde55c;
      }
    }
  }
}
</style>

<style lang="scss">
.pass-list-menu-wrap {
  width: 240px;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--devui-select-bg);
  box-sizing: border-box;

  .pass-list-search {
    margin-bottom: 16px;

    .devui-search__icon {
      svg path {
        fill: var(--devui-placeholder-text);
      }
    }
    .devui-input {
      border: none;
      background-color: var(--devui-input-bg);

      .devui-input__wrapper,
      input {
        background-color: transparent;

        &::placeholder {
          color: var(--devui-placeholder-text);
        }
      }
    }
  }

  .pass-list-item-stage {
    &:not(:first-of-type) {
      margin-top: 16px;
    }

    & > div:first-of-type {
      font-size: 14px;
      line-height: 20px;
      margin-bottom: 8px;
    }

    .tensor {
      color: #fde55c;
    }
    .tile {
      color: #7ddfe7;
    }
    .block {
      color: #63d5a8;
    }
  }

  .pass-list-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    color: var(--devui-primary-text);
    line-height: 24px;
    cursor: pointer;

    &:not(:last-of-type) {
      margin-bottom: 4px;
    }

    span:nth-of-type(2) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .search-no-res {
    text-align: center;
    color: var(--devui-placeholder-text);
    font-size: 12px;
    line-height: 16px;
  }
}
</style>
