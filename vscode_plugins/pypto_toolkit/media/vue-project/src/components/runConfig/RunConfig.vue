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
    <d-form
      v-if="schema"
      ref="formRef"
      class="tab-form"
      layout="vertical"
      size="md"
      :data="configData"
      message-type="text"
      label-size="200px"
    >
      <template v-for="tab in schema" :key="tab.key">
        <!-- 页签 -->
        <div v-show="activeTab === tab.key" class="sub-form">
          <template v-for="attribute in tab.attributes" :key="attribute.key">
            <!-- 表单项 -->
            <d-form-item class="config-form-item" :field="attribute.key" :rules="formatAttributeRules(attribute.rules)">
              <template #label>
                <div class="config-form-label" :title="getLocalLabel(attribute.label)">{{ getLocalLabel(attribute.label) }}</div>
              </template>
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

type Label = { zh: string; en: string };

const { locale } = useI18n();
function getLocalLabel(label: Label): string {
  return locale.value === 'zh' ? label.zh : label.en;
}

const { server } = useViewServer<RunConfigViewServer>();
const { filename, filepath } = server;

const schema = ref<RunConfigSchema | null>([]);
const activeTab = ref<string>();
const configData = ref<Record<string, any>>({});

onMounted(async () => {
  schema.value = await server.getSchema();
  activeTab.value = schema.value[0].key;
  configData.value = await server.getConfigData();
});

function getValue<T extends RunConfigAttribute>(attribute: T): T['defaultValue'] {
  return Reflect.get(configData.value, attribute.key) ?? attribute.defaultValue;
}

function updateValue<T extends RunConfigAttribute>(attribute: T, value: T['defaultValue']): void {
  Reflect.set(configData.value, attribute.key, value);
}

function formatAttributeRules(rules: RunConfigAttribute['rules']) {
  return rules.map((rule) => {
    const adaptedRule: Record<string, unknown> = { ...rule };
    if (rule.pattern) {
      adaptedRule.pattern = new RegExp(rule.pattern);
    }
    if (rule.unique) {
      delete adaptedRule.unique;
      adaptedRule.validator = (_: unknown, value: unknown[], callback: (err?: Error) => void) => {
        if (!value) {
          callback();
          return;
        }
        const uniqueSet = new Set(value);
        if (uniqueSet.size < value.length) {
          callback(new Error(rule.message));
          return;
        }
        callback();
      };
    }
    return adaptedRule;
  });
}

const formRef = ref();
function handleSave() {
  formRef.value.validate((isValid: boolean, invalidFields: Record<string, unknown[]>) => {
    if (isValid) {
      server.saveConfigData(configData.value);
    } else {
      const invalidKeys = Object.keys(invalidFields);
      for (const tab of schema.value) {
        const hasInvalidField = tab.attributes.some((attribute) => invalidKeys.includes(attribute.key));
        if (hasInvalidField) {
          activeTab.value = tab.key;
          return;
        }
      }
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

  &__right {
    white-space: nowrap;
  }
}

.custom-tabs {
  :deep(.devui-tabs__nav--tabs) {
    font-size: 13px;

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
    min-width: 585px;
    height: 100%;
    padding: 8px;
    overflow-y: auto;

    .config-form-label {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.devui-form__item--vertical) {
      margin-bottom: 16px;
    }

    :deep(.devui-form__label) {
      width: 100%;

      .devui-form__label-span {
        width: 100%;
        font-size: 13px;
        color: var(--pto-font-color-main);
      }
    }
  }
}

.no-schema-tip {
  font-size: 16px;
  padding: 8px;
}
</style>
