<template>
  <div class="com-graph-loading">
    <div class="loading-icon">
      <div class="bar1"></div>
      <div class="bar2"></div>
      <div class="bar3"></div>
      <div class="bar4"></div>
    </div>
    <span v-if="loadingText" class="loading-text">{{ loadingText }}</span>
    <span v-if="warningText" class="warning-text">{{ warningText }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps({
  loadingText: String,
  warningText: String,
});
</script>

<style lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.com-graph-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 33px;
  text-align: center;

  .loading-icon {
    position: relative;
    display: block;
    margin: 0 auto;
    width: 15px;
    height: 15px;
    animation: spinner 1s linear infinite;

    div {
      position: absolute;
      left: 44.5%;
      top: 37%;
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .bar1 {
      top: 0;
      left: 0;
      background: #5e7ce0;
      background: var(--devui-brand, #5e7ce0);
    }

    .bar2 {
      top: 0;
      left: 9px;
      background: #859bff;
      background: var(--devui-brand-foil, #859bff);
    }

    .bar3 {
      top: 9px;
      left: 0;
      background: #859bff;
      background: var(--devui-brand-foil, #859bff);
    }

    .bar4 {
      top: 9px;
      left: 9px;
      background: #5e7ce0;
      background: var(--devui-brand, #5e7ce0);
    }
  }

  .loading-text {
    color: $devui-text;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }

  .warning-text {
    color: #f69e39;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
  }
}

@keyframes spinner {
  0% {
    transform: rotate(0deg) scale(1);
  }

  50% {
    transform: rotate(180deg) scale(1.5);
  }

  to {
    transform: rotate(360deg) scale(1);
  }
}
</style>
