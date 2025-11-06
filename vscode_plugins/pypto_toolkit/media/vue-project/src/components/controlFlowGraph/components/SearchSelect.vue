<template>
  <div class="search-select-container">
    <d-input
      v-model="searchValue"
      class="mt-0 mb-2 search-input"
      @input="debouncedHandleInput"
      @keydown="handleKeyDown"
      style="width: 320px"
      clearable
      :placeholder="t('controlFlows.searchPlaceholder')"
      prefix="search"
    />
    <div v-if="isOpen && visibleResults.length" class="search-result-list" @mousedown.prevent>
      <div
        v-for="(item, index) in visibleResults"
        :key="item.value"
        :class="{ active: index === activeIndex }"
        class="result-item"
        @click="handleItemClick(item)"
        @mouseenter="activeIndex = index"
      >
        {{ item.label }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
// 1. 数据源
const props = defineProps<{
  options: Array<{
    label: string | number;
    value: string | number;
  }>;
}>();

// 2. 向父组件传递的事件（
const emit = defineEmits<{
  (e: 'matched-results', value: typeof props.options): void; // 匹配结果
  (e: 'selected-value', value: (typeof props.options)[0] | null): void; // 选中项
  (e: 'active-event', value: string): void; //搜索预选hover高亮事件
}>();

// 3. 内部状态
const searchValue = ref('');
const visibleResults = ref<typeof props.options>([]);
const isOpen = ref(false);
const activeIndex = ref(-1);
const { t } = useI18n();

// 4. @search事件触发（如回车、点击搜索图标，用于主动确认搜索）
const handleOfficialSearch = () => {
  if (!searchValue.value) {
    isOpen.value = false;
    emit('matched-results', []);
  }
  isOpen.value = visibleResults.length > 0;
};

const debounce = (fn, wait = 300) => {
  return (...args) => {
    // 每次触发时清除之前的计时器
    if (debounceTimer) clearTimeout(debounceTimer);
    // 重新计时，等待 wait 毫秒后执行
    debounceTimer = setTimeout(() => {
      fn.apply(this, args); // 执行原始函数
    }, wait);
  };
};
// 延迟时间：100（平衡性能和用户体验，避免卡顿感）
const debouncedEmitActiveEvent = debounce((newActiveIndex) => {
  // 仅当 newActiveIndex 不为 -1 时 emit
  if (newActiveIndex === -1) return;
  const targetValue = visibleResults?.value[newActiveIndex]?.value ?? '';
  emit('active-event', targetValue); // 通知父组件
}, 100);

watch(
  () => activeIndex.value,
  (newVal) => {
    debouncedEmitActiveEvent(newVal);
  },
);

// 防抖函数,避免连续输入时频繁筛选
let debounceTimer = null; // 防抖计时器

const debouncedHandleInput = debounce((e) => {
  handleInputChange(e);
}, 300);

// 实时输入触发模糊搜索
const handleInputChange = (val: string) => {
  if (val === '') {
    visibleResults.value = [];
    isOpen.value = false;
    emit('matched-results', []);
    return;
  } else {
    isOpen.value = true;
  }
  // 模糊匹配label/value（符合需求）
  const matched = props.options.filter((item) => String(item.label).toLowerCase().includes(val.toLowerCase()));
  visibleResults.value = matched;
  emit('matched-results', matched);
};

// 键盘控制（上下键切换、Enter确认）
const handleKeyDown = (e: KeyboardEvent) => {
  const len = visibleResults.value.length;
  if (len === 0) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      activeIndex.value = (activeIndex.value + 1) % len;
      break;
    case 'ArrowUp':
      e.preventDefault();
      activeIndex.value = (activeIndex.value - 1 + len) % len;
      break;
    case 'Enter':
      e.preventDefault();
      if (activeIndex.value >= 0) {
        handleItemClick(visibleResults.value[activeIndex.value]);
      }
      break;
  }
};

// 定义需要对外暴露的方法
const clear = () => {
  searchValue.value = ''; // 清空搜索框
  visibleResults.value = []; // 清空结果列表
  isOpen.value = false; // 关闭列表
  activeIndex.value = -1; // 重置选中索引
  emit('matched-results', []); // 通知父组件结果已清空
};
// 列表项点击
const handleItemClick = (item: (typeof props.options)[0]) => {
  searchValue.value = String(item.label);
  emit('selected-value', item);
  isOpen.value = false;
  activeIndex.value = -1;
};
// 通过defineExpose暴露方法
defineExpose({
  clear, // 暴露清空方法
});
// 组件卸载时清除计时器
onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<style scoped>
/* 父容器：确保列表定位正确 */
.search-select-container {
  position: relative;
  display: inline-block;
}

/* 搜索结果列表：宽度匹配d-search，最大高度500px */
.search-result-list {
  width: 320px; /* 与d-search宽度完全一致 */
  max-height: 500px;
  overflow-y: auto;
  background: var(--devui-select-bg);
  margin-top: 4px;
  border-radius: 8px;
  padding: 4px;
}

/* 列表项：hover/选中状态 */
.result-item {
  display: flex;
  align-items: center;
  padding: 4px;
  cursor: pointer;
  transition: background 0.2s;
  height: 28px;
  line-height: 20px;
  font-size: 13px;
  color: var(--devui-slider-bar);
}

.result-item.active,
.result-item:hover {
  color: var(--devui-slider-bar);
  background-color: var(--control-flow-search-hover-bg);
  border-radius: 4px;
}
</style>
