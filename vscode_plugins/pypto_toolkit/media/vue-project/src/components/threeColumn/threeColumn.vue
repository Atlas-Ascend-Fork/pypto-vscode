<template>
  <div class="three-column-header">
    <span class="title">{{ t('layout') }}</span>
    <div :class="['triangular', modelValue === 'triangular' && 'active']" @click="() => emits('update:modelValue', 'triangular')">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <d-tooltip :content="t('threeColumnTips')" position="bottom-start" overlay-class="three-column-design-tips">
      <div :class="['three-column', 'disabled', modelValue === 'threeColumn' && 'active']">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </d-tooltip>
  </div>
  <div :class="['three-column-content', modelValue]">
    <div><editor /></div>
    <div><slot name="comGraph" /></div>
    <div><slot name="swimGraph" /></div>
  </div>
</template>

<script setup lang="ts">
import { inject, provide } from 'vue';
import type { PropType,Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import editor from './editor.vue';


const { isDarkTheme } = inject('root') as {isDarkTheme:Ref<boolean>};

defineProps({
  modelValue: {
    type: String as PropType<'triangular' | 'threeColumn'>,
    default: 'triangular',
  },
});
const emits = defineEmits(['update:modelValue']);

const { t } = useI18n();

provide('threeColumnState', { isDarkTheme });
</script>

<style scoped lang="scss">
.three-column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 40px;
  padding: 10px;
  border-bottom: 1px solid var(--devui-split-line);
  background-color: var(--devui-page-bg);
  box-sizing: border-box;

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

.three-column-content {
  display: flex;
  width: 100%;
  height: calc(100vh - 40px);

  &.triangular {
    flex-wrap: wrap;

    & > div {
      width: 50%;
      height: 50%;
      box-sizing: border-box;
    }
    & > div:nth-of-type(1) {
      border-right: 1px solid var(--devui-border-line-deep);
      border-bottom: 1px solid var(--devui-border-line-deep);
    }
    & > div:nth-of-type(2) {
      border-left: 1px solid var(--devui-border-line-deep);
      border-bottom: 1px solid var(--devui-border-line-deep);
    }
    & > div:nth-of-type(3) {
      border-top: 1px solid var(--devui-border-line-deep);
      flex-grow: 1;
    }
  }

  &.threeColumn {
    & > div {
      flex: 1;
    }
    & > div:nth-of-type(1) {
      border-right: 1px solid var(--devui-border-line-deep);
    }
    & > div:nth-of-type(2) {
      border-left: 1px solid var(--devui-border-line-deep);
      border-right: 1px solid var(--devui-border-line-deep);
    }
    & > div:nth-of-type(3) {
      border-left: 1px solid var(--devui-border-line-deep);
    }
  }

  & > div:nth-of-type(3) {
    :deep() {
      .container {
        position: relative;
      }
    }
  }
}
</style>

<style lang="scss">
.three-column-design-tips {
  max-width: unset;
}
</style>