<template>
  
</template>
<script setup>
import { onMounted } from 'vue';
import { Message } from 'vue-devui/message';

const onMessageNotice = (text) => {
  Message({ type: 'warning', message: text });
};

onMounted(() => {
  window.ascEventBus.on('message_notice', onMessageNotice);
});
</script>