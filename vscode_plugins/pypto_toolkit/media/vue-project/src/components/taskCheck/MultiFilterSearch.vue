<template>
  <div class="multi-filter-search" v-clickoutside="closeDropdown">
    <div class="search-input-wrapper">
      <!-- 显示已添加的筛选条件标签 -->
      <div class="filter-tags">
        <div
          v-for="(tag, key) in filterTags"
          :key="key"
          class="filter-tag"
        >
          <span class="tag-label">{{ key }}: {{ tag }}</span>
          <i class="icon-close" @click="removeFilterTag(key)"></i>
        </div>
      </div>
      
      <!-- 输入框 -->
      <input
        ref="inputRef"
        v-model="inputValue"
        class="search-input"
        :placeholder="currentPlaceholder"
        :disabled="disabled"
        @focus="onInputFocus"
        @keydown.enter="onInputEnter"
        @keydown.delete="onInputDelete"
      />
      
      <!-- 下拉选择框 -->
      <div v-if="showDropdown" class="dropdown-menu">
        <div
          v-for="option in availableOptions"
          :key="option.value"
          class="dropdown-item"
          @click="selectFilterOption(option)"
        >
          {{ option.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterParams {
  opMagic?: string;
  rawMagic?: string;
  tensorAddr?: string;
}

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: '请选择筛选条件',
  },
});

const emits = defineEmits<{
  (e: 'change', params: FilterParams): void;
}>();

// 筛选选项配置
const filterOptions: FilterOption[] = [
  { value: 'opMagic', label: 'opMagic' },
  { value: 'rawMagic', label: 'rawMagic' },
  { value: 'tensorAddr', label: 'tensorAddr' },
];

const inputRef = ref<HTMLInputElement>();
const inputValue = ref('');
const showDropdown = ref(false);
const selectedFilter = ref<string>('');
const filterTags = ref<Record<string, string>>({});

// 计算当前可用的筛选项（排除已选择的）
const availableOptions = computed(() => {
  return filterOptions.filter((option) => !Object.prototype.hasOwnProperty.call(filterTags.value, option.value));
});

// 计算当前占位符文本
const currentPlaceholder = computed(() => {
  if (selectedFilter.value) {
    return `${selectedFilter.value}:`;
  }
  return props.placeholder;
});

const closeDropdown = () => {
  showDropdown.value = false;
};

const selectFilterOption = (option: FilterOption) => {
  selectedFilter.value = option.value;
  inputValue.value = '';
  showDropdown.value = false;
  inputRef.value?.focus();
};

const onInputFocus = () => {
  // 只在未选择筛选项时显示下拉菜单
  if (!selectedFilter.value) {
    showDropdown.value = true;
  }
};

const toggleDropdown = () => {
  if (!props.disabled) {
    showDropdown.value = !showDropdown.value;
  }
};

const onInputEnter = () => {
  if (selectedFilter.value && inputValue.value.trim()) {
    // 添加筛选条件
    filterTags.value[selectedFilter.value] = inputValue.value.trim();
    emitFilterChange();
    
    // 重置输入
    inputValue.value = '';
    selectedFilter.value = '';
    
    // 继续显示下拉框让用户选择下一个筛选项
    showDropdown.value = true;
    inputRef.value?.blur();
  }
};

const onInputDelete = () => {
  // 如果输入框为空且没有选中的筛选项，删除最后一个标签
  if (!inputValue.value && !selectedFilter.value) {
    const keys = Object.keys(filterTags.value);
    if (keys.length > 0) {
      const lastKey = keys[keys.length - 1];
      removeFilterTag(lastKey);
    }
  }
};

const removeFilterTag = (key: string) => {
  if (Object.prototype.hasOwnProperty.call(filterTags.value, key)) {
    delete filterTags.value[key];
    emitFilterChange();
  }
};

const emitFilterChange = () => {
  const params: FilterParams = {
    opMagic: filterTags.value.opMagic || undefined,
    rawMagic: filterTags.value.rawMagic || undefined,
    tensorAddr: filterTags.value.tensorAddr || undefined,
  };
  emits('change', params);
};

// 清除所有筛选条件
const clearAll = () => {
  filterTags.value = {};
  inputValue.value = '';
  selectedFilter.value = '';
  showDropdown.value = false;
  emitFilterChange();
};

// 重置为初始状态
const reset = () => {
  clearAll();
};

defineExpose({
  clearAll,
  reset,
});

// 自定义指令：点击外部关闭下拉框
const vClickoutside = {
  mounted(el: HTMLElement, binding: any) {
    el._clickoutside = function (event: MouseEvent) {
      if (!(el === event.target || el.contains(event.target as Node))) {
        binding.value();
      }
    };
    document.body.addEventListener('click', el._clickoutside);
  },
  unmounted(el: any) {
    document.body.removeEventListener('click', el._clickoutside);
  },
};
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.multi-filter-search {
  position: relative;
  width: 100%;
  min-width: 200px;
  
  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    min-height: 32px;
    padding: 4px 8px;
    border: 1px solid var(--devui-line);
    border-radius: 4px;
    background: var(--devui-base-bg);
    transition: border-color $devui-animation-duration-fast $devui-animation-ease-in-out-smooth;
    
    &:hover {
      border-color: var(--devui-brand);
    }
    
    &:focus-within {
      border-color: var(--devui-brand);
      box-shadow: 0 0 0 2px rgba(26, 92, 246, 0.2);
    }
    
    .filter-tags {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      margin-right: 8px;
      
      .filter-tag {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        font-size: 12px;
        color: var(--devui-brand);
        background: var(--devui-brand-active-bg);
        border-radius: 2px;
        user-select: none;
        
        .tag-label {
          margin-right: 4px;
        }
        
        .icon-close {
          font-size: 12px;
          cursor: pointer;
          opacity: 0.6;
          
          &:hover {
            opacity: 1;
          }
        }
      }
    }
    
    .search-input {
      flex: 1;
      min-width: 80px;
      border: none;
      outline: none;
      font-size: 14px;
      color: var(--devui-text);
      background: transparent;
      
      &::placeholder {
        color: var(--devui-placeholder-text);
      }
      
      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
    }
    
    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      padding: 4px 0;
      background: var(--devui-base-bg);
      border: 1px solid var(--devui-line);
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      max-height: 200px;
      overflow-y: auto;
      
      .dropdown-item {
        padding: 8px 12px;
        font-size: 14px;
        color: var(--devui-text);
        cursor: pointer;
        transition: background-color $devui-animation-duration-fast $devui-animation-ease-in-out-smooth;
        
        &:hover {
          background: var(--devui-brand-active-bg);
        }
      }
    }
  }
}
</style>