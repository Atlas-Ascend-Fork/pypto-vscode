<template>
  <div class="data-error">
    <div class="data-error__content">
      <div class="data-error__title">{{ $t('dataError.title') }}</div>
      <div class="data-error__message">{{ $t('dataError.message') }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DataError',
};
</script>

<style scoped>
.data-error {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #fff;
}

.data-error__content {
  text-align: center;
}

.data-error__title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.data-error__message {
  font-size: 14px;
  color: #6b7280;
}
</style>