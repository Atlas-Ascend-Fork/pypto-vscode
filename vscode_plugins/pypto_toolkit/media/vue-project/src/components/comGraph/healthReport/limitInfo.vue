<template>
  <div class="limit-info">
    <img :src="iconPath" alt="" />
    <span class="label">{{ label }}：</span>
    <span class="value">{{ value }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { limitInfoProps } from './types';

const props = defineProps(limitInfoProps);

const iconPath = computed(() => `${(window as any).staticPath}/static-assets/com-graph/${props.type}.svg`);
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.limit-info {
  display: flex;
  align-items: center;
  gap: 4px;

  .label,
  .value {
    font-size: 14px;
    line-height: 22px;
  }

  .label {
    color: var(--devui-placeholder-text);
  }

  .value {
    color: var(--devui-secondary-text);
    margin-left: -4px;
  }
}
</style>
