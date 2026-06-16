<template>
  <div class="compare-list-container" :class="{ 'is-collapse': !isExpand }">
    <div class="compare-list-header">
      <span class="title">Compare List</span>
      <span class="count">({{ filteredList.length }})</span>
    </div>
    <d-search
      v-model="searchKeyword"
      is-keyup-search
      :show-glow-style="false"
      placeholder="请输入关键词搜索"
      icon-position="left"
      @search="onSearch"
      class="search"
    >
    </d-search>
    <div class="compare-list-content">
      <VirtualScroll :data="filteredList">
        <template #default="scope">
          <div :class="['compare-item', selectedId === scope.data.id && 'active']" @click="onItemSelect(scope.data)">
            <div class="item-header">
              <i :class="['item-status-dot', scope.data.status]"></i>
              <span class="file-name" :title="scope.data.fileNameA">{{ scope.data.fileNameA }}</span>
              <i class="icon-arrow-right-l arrow-icon"></i>
              <span class="file-name" :title="scope.data.fileNameB">{{ scope.data.fileNameB }}</span>
            </div>
            <div class="item-footer">
              <div class="tag-group">
                <span v-if="scope.data.status === 'parsed'" class="tag-pass">Pass</span>
                <span v-if="scope.data.status === 'error'" class="tag-fail">{{ scope.data.failCount }} Fail</span>
              </div>
              <div class="time-info">
                <i class="icon-time time-icon"></i>
                {{ scope.data.time }}
              </div>
            </div>
          </div>
        </template>
      </VirtualScroll>
    </div>
    <div class="toggle-icon" @click="onExpandChange">
      <i :class="[isExpand ? 'icon-chevron-left-2' : 'icon-chevron-right-2']"></i>
    </div>
    <d-modal v-model="modalVisible" title="解析Compare文件" class="parse-compare-modal" :close-on-click-overlay="false">
      <div class="modal-content">将对 <span class="file-name">{{ selectedPendingItem?.fullFileName || selectedPendingItem?.fileNameA }}</span> 进行解析，提取OP级精度对比数据并生成Diff图</div>
      <template #footer>
        <d-modal-footer class="modal-button">
          <d-button variant="solid" color="secondary" @click="onCancel">取消</d-button>
          <d-button variant="solid" color="primary" @click="onStartParse">开始解析</d-button>
        </d-modal-footer>
      </template>
    </d-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import VirtualScroll from '../diffComGraph/virtualScroll/virtualScroll.vue';

export interface CompareFileItem {
  id: string;
  fileNameA: string;
  fileNameB: string;
  status: 'pending' | 'parsed' | 'error';
  time: string;
  failCount: number;
  fullFileName?: string;
  cmpCsvPath?:string;
  data?: any;
}

const props = defineProps({
  fileList: {
    type: Array as PropType<CompareFileItem[]>,
    default: () => [],
  },
  selectedId: {
    type: String,
    default: '',
  },
});

const emits = defineEmits(['select', 'expandChange']);

const { t } = useI18n();

const isExpand = ref(true);
const searchKeyword = ref('');

const modalVisible = ref(false);
const selectedPendingItem = ref<CompareFileItem | null>(null);

const filteredList = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return props.fileList;
  }
    return props.fileList.filter((item) => item.fileNameA.toLowerCase().includes(keyword) || item.fileNameB.toLowerCase().includes(keyword));
});

const onSearch = (value: string) => {
  searchKeyword.value = value;
};

const onItemSelect = (data: CompareFileItem) => {
  if (data.status === 'pending') {
    selectedPendingItem.value = data;
    modalVisible.value = true;
  } else if (data.status === 'error' || data.status === 'parsed') {
    emits('select', data);
  }
};

const onCancel = () => {
  modalVisible.value = false;
  selectedPendingItem.value = null;
};

const onStartParse = () => {
  if (selectedPendingItem.value) {
    emits('select', selectedPendingItem.value);
  }
  modalVisible.value = false;
  selectedPendingItem.value = null;
};

const onExpandChange = () => {
  isExpand.value = !isExpand.value;
  emits('expandChange', isExpand.value);
};
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.compare-list-container {
  position: relative;
  width: 320px;
  height: 100%;
  display: flex;
  padding: 9px 16px;
  flex-direction: column;
  background-color: var(--control-flow-bg);
  border-right: 1px solid var(--devui-split-line);
  box-sizing: border-box;
  transition: width 0.3s ease, padding 0.3s ease;

  &.is-collapse {
    width: 0;
    padding: 0;

    .compare-list-header,
    .compare-list-content,
    d-search {
      opacity: 0;
      visibility: hidden;
    }
  }

  .compare-list-header,
  .compare-list-content,
  d-search {
    transition: opacity 0.3s ease, visibility 0.3s ease;
  }

  .compare-list-header {
    display: flex;
    align-items: center;
    margin-bottom: 13px;

    .title {
      font-size: 14px;
      font-weight: 700;
      line-height: 22px;
      color: var(--devui-primary-text);
      margin-right: 8px;
    }

    .count {
      font-size: 12px;
      line-height: 20px;
      color: var(--devui-secondary-text);
    }
  }

  .compare-list-content {
    flex: 1;
    overflow: hidden;
    padding: 8px 0;
  }
  .compare-item {
    height: 66px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--devui-split-line);
    display: flex;
    flex-direction: column;
    cursor: pointer;
    position: relative;
    overflow: hidden;

    &:hover,
    &.active {
      border-radius: 8px;
      background: var(--pto-background);

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 50%;
        height: 50%;
        background-image: radial-gradient(circle, var(--devui-split-line) 1.5px, transparent 1.5px);
        background-size: 4px 4px;
        -webkit-mask-image: linear-gradient(to right, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%),
          linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%);
        mask-image: linear-gradient(to right, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%),
          linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%);
        -webkit-mask-composite: source-in;
        mask-composite: intersect;
        pointer-events: none;
      }
    }

    .item-header {
      display: flex;
      font-size: 14px;
      font-weight: 700;
      align-items: center;
      flex: 1;
      min-height: 0;
      margin-bottom: 8px;

      .item-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 8px;

        &.pending {
          background-color: var(--devui-placeholder-text);
        }

        &.parsed {
          background-color: rgba(168, 219, 129, 1);
        }

        &.error {
          background-color: rgba(238, 105, 111, 1);
        }
      }

      .file-name {
        font-size: 14px;
        color: var(--control-flow-search-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100px;
      }

      .arrow-icon {
        margin: 0 4px;
        color: var(--devui-secondary-text);
        font-size: 16px;
      }
    }

    .item-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .tag-group {
        display: flex;
        gap: 8px;
        height: 16px;
        align-items: center;
        justify-content: flex-start;

        .tag-pass {
          padding: 0 4px;
          color: rgba(168, 219, 129, 1);
          font-size: 12px;
          border: 1px solid var(--devui-status-success-line);
          border-radius: 4px;
          background: rgba(168, 219, 129, 0.2);
        }

        .tag-fail {
          padding: 0 4px;
          color: rgba(238, 105, 111, 1);
          font-size: 12px;
          border: 1px solid var(--devui-status-success-line);
          border-radius: 4px;
          background: rgba(238, 105, 111, 0.2);
        }
      }

      .time-info {
        display: flex;
        align-items: center;
        color: var(--devui-disabled-text);
        font-size: 12px;

        .time-icon {
          font-size: 12px;
          margin-right: 4px;
        }
      }
    }
  }

  .search {
    :deep() {
      .devui-input {
        background-color: var(--control-flow-sidebar-bg);

        .devui-input__wrapper {
          background-color: transparent;
        }
      }
    }
  }
  .toggle-icon {
    position: absolute;
    right: -17px;
    top: calc(50% - 20px);
    z-index: 15;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 40px;
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
    background-color: var(--devui-card-bg);
    cursor: pointer;
  }
}
</style>
<style lang="css">
@import 'devui-theme/styles-var/devui-var.scss';
.parse-compare-modal.devui-modal {
  width: 508px;
  border: 1px solid var(--welcome-banner-point);
  border-radius: 16px;
  background: var(--devui-tooltip-bg);
}

.parse-compare-modal .modal-content .file-name {
  font-weight: 700;
  word-break: break-all;
}
</style>