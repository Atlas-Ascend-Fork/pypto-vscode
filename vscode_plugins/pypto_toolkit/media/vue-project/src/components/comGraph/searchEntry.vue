<template>
  <div class="search-entry-container" :style="{ backgroundImage: 'url(' + svgPath + ')' }">
    <img :src="iconPath" />
    <div class="node-count-tips">{{ t('comGraph.nodeCountTips') }}</div>
    <div class="render-timeout-tips">{{ t('comGraph.renderTimeoutTips') }}</div>
    <div class="entry-wrap">
      <div class="full-render" @click="() => emits('fullRender')">
        <span class="title">{{ t('comGraph.fullRenderComGraph') }}</span>
        <span class="desc">{{ t('comGraph.fullRenderComGraphDesc') }}</span>
      </div>
      <div class="search-mode" @click="() => emits('searchMode')">
        <span class="title">{{ t('comGraph.searchMode') }}</span>
        <span class="desc">{{ t('comGraph.searchModeDesc') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const emits = defineEmits(['fullRender', 'searchMode']);

const { isDarkTheme } = inject('root');
const { t } = useI18n();
const svgPath = computed(() => `"${(window as any).staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);
const iconPath = `${(window as any).staticPath}/static-assets/logo.png`;
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.search-entry-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
  background-repeat: repeat;

  & > img {
    width: 48px;
    height: 48px;
    margin-bottom: 20px;
  }

  .node-count-tips,
  .render-timeout-tips {
    font-size: 14px;
    color: var(--devui-primary-text);
    line-height: 22px;
  }

  .entry-wrap {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-top: 26px;

    .full-render,
    .search-mode {
      display: flex;
      flex-direction: column;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid transparent;
      background-color: var(--devui-secondary-button-bg);
      transition: border-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth,
        background-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
      cursor: pointer;

      .title {
        font-size: 16px;
        color: var(--devui-primary-text);
        line-height: 22px;
      }
      .desc {
        font-size: 14px;
        color: var(--devui-secondary-text);
        line-height: 22px;
      }

      &:hover {
        border-color: var(--devui-title-text);
        background-color: var(--devui-flow-water-bg);
        box-shadow: var(--devui-select-shadow);
      }
    }
  }
}
</style>
