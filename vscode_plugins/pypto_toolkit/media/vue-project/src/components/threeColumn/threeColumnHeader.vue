<template>
  <div class="three-column-header">
    <div class="three-column-header-left">
      <span class="title">{{ t('layout') }}</span>
      <div :class="['triangular', currentLayoutMode === 'triangular' && 'active']" @click="() => (currentLayoutMode = 'triangular')">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <d-tooltip :content="t('threeColumnTips')" position="bottom-start" overlay-class="three-column-design-tips">
        <div :class="['three-column', 'disabled', currentLayoutMode === 'threeColumn' && 'active']">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </d-tooltip>
      <div class="dividing-line"></div>
      <DataList id="steps-navbar-datalist" />
    </div>
    <div>
      <d-tooltip :content="t('reset')" position="bottom-end">
        <i class="icon-reset" @click="resetLayout"></i>
      </d-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { IThreeColumnCtx, ThreeColumnProvideKey } from './types';
import DataList from './dataList.vue';

const { t } = useI18n();
const { currentLayoutMode, resetLayout } = inject(ThreeColumnProvideKey) as IThreeColumnCtx;
</script>

<style scoped lang="scss">
.three-column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 40px;
  padding: 10px;
  border-bottom: 1px solid var(--devui-split-line);
  background-color: var(--devui-page-bg);
  box-sizing: border-box;

  .three-column-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon-reset {
    font-size: 14px;
    cursor: pointer;
  }

  .title {
    font-size: 14px;
    line-height: 20px;
    color: var(--devui-title-text);
  }

  .triangular,
  .three-column {
    display: flex;
    gap: 1px;
    width: 24px;
    height: 18px;
    padding: 2px;
    border-radius: 4px;
    border: 1px solid var(--devui-placeholder-text);
    box-sizing: border-box;
    cursor: pointer;

    span {
      border-radius: 1px;
      background-color: var(--devui-placeholder-text);
    }

    &.active {
      border-color: var(--devui-active-icon);
      span {
        background-color: var(--devui-active-icon);
      }
    }
  }

  .dividing-line {
    width: 1px;
    height: 20px;
    background-color: var(--devui-placeholder-text);;
    margin-left: 20px;
    margin-right: 16px;
  }

  .triangular {
    flex-wrap: wrap;

    span {
      width: calc(50% - 0.5px);
    }
    span:nth-of-type(3) {
      flex-grow: 1;
    }
  }

  .three-column {
    &.disabled {
      border-color: var(--devui-disabled-icon);
      cursor: not-allowed;

      span {
        background-color: var(--devui-disabled-icon);
      }
    }

    span {
      flex: 1;
    }
  }
}
</style>
