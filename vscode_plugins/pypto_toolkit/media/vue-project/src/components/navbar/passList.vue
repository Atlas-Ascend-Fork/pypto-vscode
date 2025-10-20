<template>
  <d-dropdown
    :visible="isOpen"
    trigger="manually"
    :position="['bottom']"
    :offset="10"
    close-scope="blank"
    class="pass-list-menu-wrap"
    @toggle="(val) => (isOpen = val)"
  >
    <div class="pass-list-container" @click="isOpen = !isOpen">
      <div :class="['pass-type', currentData.passStage]">{{ UpperFirstStr(currentData.passStage) }}</div>
      <div>
        <div class="pass-content">{{ currentData.passIndex }} {{ currentData.passName }}</div>
        <div class="dot-step">
          <ThreeDot dot-color="var(--devui-split-line)" />
          <span :class="['big-dot', isLastGraph('tensor') && 'last-tensor']"></span>
          <ThreeDot :dot-color="isMiddleTile() ? '#7ddfe7' : 'var(--devui-split-line)'" />
          <span :class="['big-dot', isLastGraph('tile') && 'last-tile']"></span>
          <ThreeDot dot-color="var(--devui-split-line)" />
          <span :class="['big-dot', isLastGraph('block') && 'last-block']"></span>
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
      <div v-for="item in Object.keys(renderPassList)" :key="item" class="pass-list-item-stage">
        <div :class="[item]">{{ UpperFirstStr(item) }} Graph</div>
        <div v-for="pass in renderPassList[item]" :key="pass.passIndex" class="pass-list-item" @click="() => selectPass(pass)">
          <span>{{ pass.passIndex }}</span>
          <span>{{ pass.passName }}</span>
        </div>
      </div>
    </template>
  </d-dropdown>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ThreeDot from './threeDot.vue';
import { transformPassList, UpperFirstStr } from './util';
import { NavbarContext, NavbarProvideKey, PassData } from './navbar-types';

const { t } = useI18n();
const { passList } = inject(NavbarProvideKey) as NavbarContext;
const filterKey = ref('');
const isOpen = ref(false);
const currentData = ref<PassData>({ passIndex: '09', passStage: 'block', passName: 'DuplicateView', hasHealthReport: false });
let PassListMap: Partial<Record<PassData['passStage'], PassData[]>> = {};

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
    }
  },
  { immediate: true },
);

function selectPass(pass: PassData) {
  isOpen.value = false;
  currentData.value = pass;
}

function isLastGraph(passStage: PassData['passStage']) {
  const temp = PassListMap[passStage];
  if (temp?.length) {
    return currentData.value.passIndex === temp[temp.length - 1].passIndex;
  }
}

function isMiddleTile() {
  const temp = PassListMap['tile'];
  if (temp?.length && currentData.value.passStage === 'tile') {
    return currentData.value.passIndex !== temp[temp.length - 1].passIndex;
  }
}
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
  }
}
</style>
