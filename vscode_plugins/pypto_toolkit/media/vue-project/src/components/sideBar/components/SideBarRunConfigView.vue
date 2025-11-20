<template>
  <div class="sidebar-container">
    <!-- 标题栏 -->
    <div class="header">
      <div class="name">
        {{ t('sideBar.config.configTitle') }}
      </div>
      <div class="expand" @click="configExpand">
        <d-icon :name="isExpanded ? 'icon-chevron-up-2' : 'icon-chevron-down-2'"></d-icon>
      </div>
      <div class="flex1"></div>
      <div class="config-tools" :class="{ hidden: isExpanded }">
        <d-popover :position="['top-start']" :offset="{ mainAxis: 10, crossAxis: 10 }" trigger="hover" :mouse-enter-delay="500">
          <template #content>
            <div>{{ t('sideBar.config.viewSchemaFile') }}</div>
          </template>
          <d-icon class="icon" name="icon-view-report"></d-icon>
        </d-popover>
        <d-popover :position="['top-start']" :offset="{ mainAxis: 10, crossAxis: 10 }" trigger="hover" :mouse-enter-delay="500">
          <template #content>
            <div>{{ t('sideBar.config.addConfigFile') }}</div>
          </template>
          <d-icon class="icon" name="icon-add" @click="addNewCustomConfig"></d-icon>
        </d-popover>
      </div>
    </div>
    <div class="config-list" :class="{ hidden: isExpanded }">
      <!-- 每组数据 -->
      <div v-for="(config, configIndex) in customConfigList" :key="configIndex">
        <div class="config-line" @click="openConfigVIew(config)">
          <span class="config-line-title"> {{ config.configBaseName }}</span>
          <i class="config-del-icon icon-delete" @click.stop="delConfig(config)"></i>
        </div>
      </div>
      <div class="bottom-line"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { openPtoConfig } from '@/apis/opener';
import { addCustomFile, delCustomFile, getCustomFileList } from '@/apis/schema-config';
import { CustomConfigItemVo } from 'ext:/types/config-schema/config-schema';
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const isExpanded = ref(false);
const emit = defineEmits<{ (e: 'tree-expand', value: boolean) }>();
const isLoading = ref(false);
const customConfigList = ref<CustomConfigItemVo[]>();
function configExpand() {
  isExpanded.value = !isExpanded.value;
  emit('tree-expand', isExpanded.value);
}

async function delConfig(item: CustomConfigItemVo) {
  await delCustomFile(item.configPath);
  getFileList();
}

/**
 * 根据现有文件名列表生成新文件名(中文+数字格式：自定义配置N）
 * @param fileNames - 现有文件名数组（格式：自定义配置1、自定义配置2...todo：待高保真确认名称是否可自定义）
 * @returns 新增文件的文件名
 */
function generateNewConfigFileName(fileNames: CustomConfigItemVo[]): string {
  // 定义固定前缀和匹配正则（前缀+纯数字）
  const FILE_PREFIX = '自定义配置';
  const FILE_NAME_REGEX = new RegExp(`^${FILE_PREFIX}(\\d+)$`);

  // 处理空列表：直接返回第一个文件
  if (fileNames.length === 0) {
    return `${FILE_PREFIX}1`;
  }

  // 获取最后一个文件名并校验格式
  const lastFileName = fileNames[fileNames.length - 1].configBaseName;
  const matchResult = lastFileName.match(FILE_NAME_REGEX);

  if (!matchResult) {
    return `${lastFileName}(1)`
  }

  // 提取数字并自增（处理多位数场景）
  const currentNumber = parseInt(matchResult[1], 10);
  const newNumber = currentNumber + 1;

  // 生成新文件名
  return `${FILE_PREFIX}${newNumber}`;
}

async function addNewCustomConfig() {
  let name = generateNewConfigFileName(customConfigList.value);
  const addRes = await addCustomFile(name);
  if (addRes) {
    await getFileList();
  }
}

async function openConfigVIew(config: CustomConfigItemVo) {
  await openPtoConfig({ configPath: config.configPath, pathName: config.configBaseName });
}

async function getFileList() {
  customConfigList.value = await getCustomFileList();
}

onMounted(() => {
  getFileList();
});
</script>

<style scoped lang="less">
/**
 * 基础样式
 */
.sidebar-container {
  background: var(--devui-card-bg);
  color: var(--control-flow-sidebar-search-icon);
  min-height: 100%;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  gap: 11px;
  padding: 8px 0;

  .header {
    display: flex;
    justify-content: start;
    align-items: center;
    height: 28px;
    padding: 0 16px;

    .name {
      color: var(--control-flow-sidebar-search-title);
      margin: 0;
      font-size: 14px;
      line-height: 27px;
    }

    .expand {
      width: 28px;
      height: 28px;
      padding: 7px;
      font-size: 14px;
      cursor: pointer;

      :deep(*) {
        color: var(--control-flow-sidebar-search-icon);
      }
    }

    .config-tools {
      display: flex;
      height: 28px;
      padding: 7px;
      font-size: 14px;
      gap: 8px;

      :deep(*) {
        color: var(--control-flow-sidebar-search-icon);
      }

      .icon {
        cursor: pointer;
        &:hover {
          color: var(--devui-link-text);
        }
      }
    }

    .flex1 {
      flex: 1;
      background-color: green;
    }

    .icon {
      font-size: 16px;
      opacity: 0.8;
    }
  }

  .config-list {
    flex: 1;
    padding: 10px;
    overflow-y: auto;

    .config-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      width: 100%;
      height: 32px;
      cursor: pointer;
      padding: 0 8px;
      border-radius: 4px;

      &:hover {
        background-color: var(--devui-input-hover-bg);
      }

      .config-line-title {
        font-size: 14px;
      }
      .config-del-icon {
        transition: all 0.2s ease;
        opacity: 0; /* 默认透明（隐藏） */
        &:hover {
          color: var(--devui-link-text);
        }
      }
    }

    /* 鼠标悬浮在 .config-line 时，显示图标 */
    .config-line:hover .config-del-icon {
      opacity: 1; /* 显示 */
    }
  }

  .bottom-line {
    width: 100%;
    height: 1px;
    padding-bottom: 4px;
    border-bottom: 2px solid var(--devui-split-line);
  }
}
</style>
