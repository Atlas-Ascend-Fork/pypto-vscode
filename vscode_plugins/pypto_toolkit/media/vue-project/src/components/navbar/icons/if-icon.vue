<template>
  <div class="if-icon-wrap">
    <div class="if-icon-inner"></div>
  </div>
</template>

<style scoped lang="scss">
.if-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 3px solid var(--devui-icon);
  border-radius: 3px;
  box-sizing: border-box;
  transform: rotate(45deg) scale(0.8);

  .if-icon-inner {
    width: 4px;
    height: 4px;
    background-color: var(--devui-icon);
  }
}
</style>