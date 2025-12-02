<template>
  <div class="com-graph-error-container">
    <div
    :style="{
        backgroundImage: 'url('+ errorSvgPath + ')',
        backgroundRepeat: 'repeat',
        backgroundSize: '80px 80px',
        height: '80px',
        width: '80px',
      }"
    > </div>
    <span class="error-text">{{ props.jsonContent }}</span>
  </div>
</template>

<script setup lang="ts">
import {defineProps, ref } from 'vue';


const errorSvgPath = ref(`"${window.staticPath}/static-assets/data_error.svg"`);

const props = defineProps({
  jsonContent: {
    type: String,
    default: ''
  },
})

</script>

<style lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';
.com-graph-error-container {
  display: flex;
  flex-direction:column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: $devui-base-bg;
  gap: 32px;


  .error-text {
    color: $devui-text;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    letter-spacing: 0px;
    text-align: center;
    white-space: pre-wrap;
  }
}

</style>