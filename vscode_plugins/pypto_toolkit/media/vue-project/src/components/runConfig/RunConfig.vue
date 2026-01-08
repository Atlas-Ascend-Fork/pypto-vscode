<template>
  <div class="config-containt">
    <div class="header-panel">
      <div class="header-panel__left">
        <div class="header-panel__title">{{ filename }}</div>
        <div class="header-panel__file-path">{{ `${$t('runConfig.filepathLabel')}${filepath}` }}</div>
      </div>
      <div class="header-panel__right">
        <PtoButton type="text" @click="handleViewSourceFile">{{ $t('runConfig.viewSourceFile') }}</PtoButton>
        <template v-if="schema">
          <PtoButton @click="handleCancel">{{ $t('public.cancel') }}</PtoButton>
          <PtoButton type="primary" @click="handleSave">{{ $t('public.save') }}</PtoButton>
        </template>
      </div>
    </div>
    <d-tabs class="custom-tabs" v-model="activeTab" :show-content="false">
      <template v-for="tab in schema" :key="tab.key">
        <d-tab :id="tab.key" :title="tab.label"> </d-tab>
      </template>
    </d-tabs>
    <d-form v-if="schema" ref="formRef" class="tab-form" layout="vertical" size="normal" :data="configData" message-type="text">
      <template v-for="tab in schema" :key="tab.key">
        <!-- 页签 -->
        <div v-show="activeTab === tab.key" class="sub-form">
          <template v-for="attribute in tab.attributes" :key="attribute.key">
            <!-- 表单项 -->
            <d-form-item
              class="config-form-item"
              :field="attribute.key"
              :label="getLocalLabel(attribute.label)"
              :rules="getFormItemRules(attribute, tab.key)"
            >
              <RunConfigController
                :attribute="attribute"
                :model-value="getValue(attribute)"
                @update:model-value="updateValue(attribute, $event)"
              />
            </d-form-item>
          </template>
        </div>
      </template>
    </d-form>
    <div v-else class="no-schema-tip">{{ $t('runConfig.noSchemaFound') }}</div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { RunConfigSchema, RunConfigAttribute } from 'ext:/types/config-schema';
import { RunConfigViewServer } from 'ext:/view/servers/run-config-view-server';

import PtoButton from '@/components/ui/PtoButton.vue';
import { useViewServer } from '@/core/use-view-server';

import RunConfigController from './RunConfigController.vue';
import { throttle } from 'lodash-es';

type Label = { zh: string; en: string };

const { locale } = useI18n();
function getLocalLabel(label: Label): string {
  return locale.value === 'zh' ? label.zh : label.en;
}

const { server } = useViewServer<RunConfigViewServer>();
const { filename, filepath } = server;

const schema = ref<RunConfigSchema | null>([]);

const activeTab = ref<string>();

function switchTab(tabKey: string) {
  activeTab.value = tabKey;
}

const throttledSwitchTab = throttle(switchTab, 200);

const configData = ref<Record<string, any>>({});

onMounted(async () => {
  schema.value = await server.getSchema();
  activeTab.value = schema.value[0].key;
  configData.value = await server.getConfigData();
});

function getValue<T extends RunConfigAttribute>(attribute: T): T['defaultValue'] {
  return Reflect.get(configData.value, attribute.key) ?? attribute.defaultValue;
}

function updateValue<T extends RunConfigAttribute<any>>(attribute: T, value: T['defaultValue']): void {
  Reflect.set(configData.value, attribute.key, value);
}

function getFormItemRules(attribute: RunConfigAttribute, tabKey: string): object[] {
  return [
    {
      validator: (_, value, callback) => {
        const emptyValue = value === null || value === undefined;
        function showValidateError(message: string) {
          callback(new Error(message));
          throttledSwitchTab(tabKey);
        }
        for (const rule of attribute.rules) {
          // 判断空值
          if (rule.required && emptyValue) {
            return showValidateError(rule.message);
          } else if (emptyValue) {
            continue;
          }

          // 判断值范围
          if (Reflect.has(rule, 'min') && value < rule.min) {
            return showValidateError(rule.message);
          }
          if (Reflect.has(rule, 'max') && value > rule.max) {
            return showValidateError(rule.message);
          }
        }
        return callback();
      },
      trigger: 'blur',
    },
  ];
}

const formRef = ref();
function handleSave() {
  formRef.value.validate((isValid) => {
    if (isValid) {
      server.saveConfigData(configData.value);
    }
  });
}

function handleCancel() {
  server.cancelEdit();
}

function handleViewSourceFile() {
  server.openSourceFile();
}
</script>

<style scoped lang="less">
.config-containt {
  width: 100vw;
  height: 100vh;
  color: var(--pto-font-color-title);
  box-sizing: border-box;
  padding: 16px;
}

// 颜色等高保真统一适配主题
.header-panel {
  width: 100%;
  height: 58px;
  display: flex;
  justify-content: space-between;

  &__title {
    height: 26px;
    line-height: 26px;
    font-size: 18px;
    font-weight: 700;
  }

  &__file-path {
    margin-top: 8px;
    font-size: 12px;
    color: var(--pto-font-color-sub);
  }
}

.custom-tabs {
  :deep(.devui-tabs__nav--tabs) {
    li {
      margin-left: 24px;

      &:first-child {
        margin-left: 0;
      }

      &.active,
      &:hover:not(.disabled) {
        a {
          color: var(--pto-font-color-title);
        }

        &::after {
          background-color: var(--pto-font-color-title);
        }
      }
    }
  }
}

.tab-form {
  height: calc(100% - 58px - 34px);

  .sub-form {
    height: 100%;
    padding: 8px;
    overflow-y: auto;
  }
}

.no-schema-tip {
  font-size: 16px;
  padding: 8px;
}
</style>
