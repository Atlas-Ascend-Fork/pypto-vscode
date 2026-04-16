<template>
  <div class="overview-card-wrap">
    <div v-for="item in data" :key="item.label" class="overview-card-item-data">
      <div>
        <span class="label-text">{{ item.label }}</span>
        <d-tooltip v-if="item.desc" overlay-class="com-graph-report-standard-tips" :position="['top', 'top-start', 'top-end']">
          <i class="icon icon-helping"></i>
          <template #content>
            <span>{{ item.desc }}</span>
          </template>
        </d-tooltip>
      </div>
      <span class="value-text">{{ item.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import type { OverviewCardData } from './precisionReport.types';

defineProps({
  data: { type: Array as PropType<OverviewCardData[]>, default: () => [] },
});
</script>

<style scoped lang="scss">
.overview-card-wrap {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 16px;
  border: 1px solid var(--devui-secondary-button-border);
  border-radius: 12px;
  background-color: var(--devui-secondary-button-disabled-bg);
  box-sizing: border-box;
  .overview-card-item-data {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    .label-text {
      font-size: 14px;
      line-height: 22px;
      margin-right: 4px;
      color: var(--devui-title-text);
      opacity: 0.8;
    }
    .value-text {
      font-size: 18px;
      font-weight: bold;
      line-height: 26px;
      color: var(--devui-title-text);
    }
  }
}
</style>
