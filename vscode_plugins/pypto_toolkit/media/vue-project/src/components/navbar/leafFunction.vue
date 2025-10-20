<template>
  <d-dropdown :position="['bottom-start']" :offset="14" @toggle="(val) => (isOpen = val)">
    <div :class="['leaf-function-container', isOpen && 'is-open']">
      <div class="select-val">{{ currentLeaf?.magicName }}</div>
      <i class="icon-chevron-down-2"></i>
    </div>
    <template #menu>
      <div class="leaf-function-list">
        <div
          v-for="item in leafFunctions"
          :key="item.magic"
          :title="item.magicName"
          :class="['list-item', item.magic === currentLeaf.magic && 'active']"
          @click="() => onClick(item)"
        >
          {{ item.magicName }}
        </div>
      </div>
    </template>
  </d-dropdown>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue';
import { NavbarProvideKey } from './navbar-types';
import type { NavbarContext, LeafFunctionData } from './navbar-types';

const { leafFunctions } = inject(NavbarProvideKey) as NavbarContext;
const isOpen = ref(false);
const currentLeaf = ref(leafFunctions.value[0]);

const onClick = (item: LeafFunctionData) => {
  currentLeaf.value = item;
};
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.leaf-function-container {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;

  .select-val {
    color: var(--devui-title-text);
    font-size: 12px;
    line-height: 16px;
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
  max-width: 300px;
  padding: 8px;
  border-radius: 8px;
  background-color: var(--devui-select-bg);
  box-sizing: border-box;

  .list-item {
    max-width: 100%;
    height: 28px;
    line-height: 20px;
    font-size: 12px;
    padding: 4px 8px;
    color: var(--devui-primary-text);
    border-radius: 4px;
    box-sizing: border-box;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;

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
}
</style>
