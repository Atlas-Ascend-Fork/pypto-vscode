<template>
  <div class="tips-info">
    <div class="title">{{ title }}</div>
    <div v-if="count !== undefined" class="count">{{ count }}</div>
  </div>
</template>

<script setup lang="ts">
import { tipsInfoProps } from './types';

defineProps(tipsInfoProps);
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.tips-info {
  .title {
    display: inline-block;
    color: var(--devui-secondary-text);
    font-size: 12px;
    font-weight: 500;
    line-height: 18px;
    margin-right: 4px;
  }


  .count {
    color: var(--devui-primary-text);
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
  }
}
</style>
