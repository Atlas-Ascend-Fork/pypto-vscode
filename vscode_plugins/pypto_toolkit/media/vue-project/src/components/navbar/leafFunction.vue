<template>
  <d-dropdown :position="['bottom-start']" :offset="18" class="leaf-function-menu-wrap" @toggle="onToggle">
    <div :class="['leaf-function-container', isOpen && 'is-open']">
      <div v-if="currentLeaf.leafName" class="select-val" :title="currentLeaf.leafName">{{ `leaf_${currentLeaf.programId}` }}</div>
      <div v-else class="please-select-placeholder">{{ t('pleaseSelect') }}</div>
      <i class="icon-chevron-down-2"></i>
    </div>
    <template #menu>
      <div ref="listEl" class="leaf-function-list pypto-scrollbar">
        <div v-if="ownedList.length" class="owned-title">{{ t('directRelative') }}</div>
        <div
          v-for="item in ownedList"
          :key="item.leafName"
          :title="item.leafName"
          :class="['list-item', item.leafName === currentLeaf.leafName && 'active']"
          @click="() => jumpOwn(item)"
        >
          {{ `leaf_${item.programId}` }}
        </div>
        <div v-if="notOwnedList.length" class="dividing-line"></div>
        <div v-if="notOwnedList.length" class="not-owned-title">{{ t('notDirectRelative') }}</div>
        <div
          v-for="item in notOwnedList"
          :key="item.leafName"
          :title="item.leafName"
          :class="['not-owned-list-item', item.leafName === currentLeaf.leafName && 'active']"
        >
          <div>
            <div :title="item.leafName" @click="() => jumpOwn(item)">{{ `leaf_${item.programId}` }}</div>
            <div :title="item.rootPathName">{{ item.rootPathName }}</div>
          </div>
          <i class="icon-share-one" @click="() => jumpNotOwn(item)"></i>
        </div>
      </div>
    </template>
  </d-dropdown>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { NavbarProvideKey } from './navbar-types';
import type { NavbarContext } from './navbar-types';
import type { LeafInPass } from 'ext:/types/control-flow';
import { transformLeafFunctionList } from './util';

const { t } = useI18n();
const { rootProps, leafFunctions, currentLeafData, jumpComGraph } = inject(NavbarProvideKey) as NavbarContext;
const isOpen = ref(false);
const ownedList = ref<LeafInPass[]>([]);
const notOwnedList = ref<LeafInPass[]>([]);
const listEl = ref<HTMLElement>();
const currentLeaf = computed<Partial<LeafInPass>>(() => {
  if (rootProps.currentLeafName) {
    for (let i = 0; i < leafFunctions.value.length; i++) {
      const item = leafFunctions.value[i];
      if (item.leafFileName === rootProps.currentLeafName) {
        currentLeafData.value = item;
        return item;
      }
    }
  }
  return {};
});

watch(
  leafFunctions,
  (val) => {
    if (val?.length) {
      const { ownedList: own, notOwnedList: notOwn } = transformLeafFunctionList(val);
      ownedList.value = own;
      notOwnedList.value = notOwn;
    }
  },
  { immediate: true },
);

function onToggle(val) {
  isOpen.value = val;
  if (val) {
    nextTick(() => {
      const selector = currentLeaf.value.isOwnedLeaf ? '.list-item.active' : '.not-owned-list-item.active';
      const activeItem = listEl.value.querySelector(selector);
      if (activeItem) {
        const activeItemTop = activeItem.getBoundingClientRect().top;
        const listTop = listEl.value.getBoundingClientRect().top;
        listEl.value.scrollTop = activeItemTop - listTop;
      }
    });
  }
}

function jumpOwn(item: LeafInPass) {
  jumpComGraph(item.leafFilePath);
}

function jumpNotOwn(item: LeafInPass) {
  jumpComGraph(item.rootFilePath);
}
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.leaf-function-container {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;

  &:hover {
    .select-val {
      color: var(--devui-operation-text-hover);
    }
  }

  .select-val {
    color: var(--devui-title-text);
    font-size: 12px;
    line-height: 16px;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
  }

  .please-select-placeholder {
    font-size: 12px;
    line-height: 16px;
    color: var(--devui-placeholder-text);
    max-width: 36px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  i {
    font-size: 16px;
    color: var(--devui-title-text);
    transition: transform $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
  }

  &.is-open {
    i {
      transform: rotate(180deg);
    }
  }
}

.leaf-function-list {
  min-width: 84px;
  max-width: 300px;
  max-height: 400px;
  overflow: auto;

  .owned-title,
  .not-owned-title {
    color: var(--devui-placeholder-text);
    font-size: 14px;
    line-height: 18px;
    padding: 4px 8px;
  }

  .dividing-line {
    width: 100%;
    height: 1px;
    margin-bottom: 4px;
    background-color: var(--devui-split-line);
  }

  .list-item {
    max-width: 100%;
    height: 36px;
    line-height: 20px;
    font-size: 12px;
    padding: 8px;
    color: var(--devui-primary-text);
    border-radius: 4px;
    box-sizing: border-box;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;

    &:not(:last-of-type) {
      margin-bottom: 4px;
    }

    &.active {
      background-color: var(--devui-input-active-bg);
    }

    &:not(.active):hover {
      background-color: var(--devui-input-hover-bg);
    }
  }

  .not-owned-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    transition: background-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;

    &:not(:last-of-type) {
      margin-bottom: 4px;
    }

    &:not(.active):hover {
      background-color: var(--devui-input-hover-bg);
      cursor: pointer;
    }

    &.active {
      background-color: var(--devui-input-active-bg);
      cursor: pointer;

      & > div > div:first-of-type {
        color: var(--devui-operation-text-hover);
      }
    }

    & > div {
      max-width: calc(100% - 22px);

      div {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        &:first-of-type {
          font-size: 13px;
          line-height: 20px;
          color: var(--devui-primary-text);
        }

        &:last-of-type {
          font-size: 12px;
          line-height: 16px;
          color: var(--devui-secondary-text);
          margin-top: 1px;
        }
      }
    }

    i {
      font-size: 14px;
    }
  }
}
</style>

<style lang="scss">
.devui-flexible-overlay:has(.leaf-function-menu-wrap) {
  border-radius: 8px;
  box-shadow: var(--devui-select-shadow);
}
.leaf-function-menu-wrap {
  padding: 8px;
  border-radius: 8px;
  background-color: var(--devui-select-bg);
  box-sizing: border-box;
}
</style>
