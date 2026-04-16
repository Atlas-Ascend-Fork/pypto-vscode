<template>
  <div v-if="modelValue" class="custom-sort-modal-wrap">
    <div class="custom-sort-modal-head">
      <span>{{ t('customSort') }}</span>
      <em class="icon icon-close" @click="() => emits('update:modelValue', false)"></em>
    </div>
    <div class="custom-sort-modal-content">
      <div class="custom-sort-rule">{{ t('sortRule') }}：</div>
      <div
        v-sortable="{
          list: selectedCols,
          handle: '.drag-handle',
          drop: onDrop,
        }"
      >
        <div v-for="item in selectedCols" :key="item.field" class="custom-sort-item">
          <i class="icon icon-list-view drag-handle"></i>
          <div class="custom-sort-config">
            <d-select v-model="item.field" :show-glow-style="false" @value-change="updateFieldOptions">
              <template v-for="item in fieldOptions" :key="item.name">
                <d-option v-show="item.show" :value="item.value" :name="item.name"></d-option>
              </template>
            </d-select>
            <d-select v-model="item.direction" :options="directionOptions" :show-glow-style="false" style="margin-top: 8px"></d-select>
          </div>
          <i class="icon icon-delete" @click="() => onRemoveColumn(item)"></i>
        </div>
      </div>
      <div :class="['add-column', disableAddColumn && 'add-column-disabled']" @click="onAddColumn">
        <i class="icon icon-add"></i>
        <span>{{ t('addColumn') }}</span>
      </div>
    </div>
    <div class="custom-sort-modal-btn-wrap">
      <d-button variant="solid" color="secondary" class="cancel-button" @click="() => emits('update:modelValue', false)">
        {{ t('no') }}
      </d-button>
      <d-button variant="solid" color="primary" :disabled="!selectedCols.length" class="confirm-button" @click="onConfirm">
        {{ t('yes') }}
      </d-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SelectedSortCol } from './precisionReport.types';
import vSortable from './sortable-directive';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
});
const emits = defineEmits(['update:modelValue', 'confirm']);

const { t } = useI18n();
const directionOptions = [
  { name: `${t('asc')} (1, 2, 3...)`, value: 'asc' },
  { name: `${t('desc')} (3, 2, 1...)`, value: 'desc' },
];
const selectedCols = ref<SelectedSortCol[]>([{ field: 'offset', direction: 'asc' }]);
const fieldOptions = ref([
  { name: 'OFFSET', value: 'offset', show: true },
  { name: 'OFFSET_RAW', value: 'offsetRaw', show: true },
  { name: 'A>VALUE', value: 'aValue', show: true },
  { name: 'B>VALUE', value: 'bValue', show: true },
  { name: `AB${t('relativeError')}`, value: 'abRe', show: true },
  { name: `AB${t('absoluteError')}`, value: 'abAe', show: true },
  { name: t('errorJudgmentTolerance'), value: 'abTol', show: true },
]);
const disableAddColumn = ref(false);

const updateFieldOptions = () => {
  const selectedFields = selectedCols.value.map((item) => item.field);
  let allHide = true;
  for (const item of fieldOptions.value) {
    item.show = !selectedFields.includes(item.value);
    allHide &&= !item.show;
  }
  disableAddColumn.value = allHide;
};

const onDrop = ({ targetIndex, sourceIndex }) => {
  selectedCols.value.splice(targetIndex, 0, selectedCols.value.splice(sourceIndex, 1)[0]);
};

const onAddColumn = () => {
  const notSelectedCol = fieldOptions.value.find((item) => item.show);
  if (!notSelectedCol) {
    return;
  }
  selectedCols.value.push({ field: notSelectedCol.value, direction: 'asc' });
  updateFieldOptions();
};

const onRemoveColumn = (col: SelectedSortCol) => {
  const index = selectedCols.value.findIndex((item) => item.field === col.field);
  selectedCols.value.splice(index, 1);
  updateFieldOptions();
};

const onConfirm = () => {
  emits('confirm', [...selectedCols.value]);
  emits('update:modelValue', false);
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      selectedCols.value = [{ field: 'offset', direction: 'asc' }];
      updateFieldOptions();
    }
  },
);

onMounted(updateFieldOptions);
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.custom-sort-modal-wrap {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 10;
  transform: translate(-50%, -50%);
  width: 350px;
  padding: 20px 0;
  border: 1px solid var(--devui-modal-line);
  border-radius: 16px;
  box-shadow: var(--devui-modal-shadow);
  background-color: var(--devui-select-bg);
  box-sizing: border-box;
  .custom-sort-modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 0 20px;
    span {
      font-weight: bold;
      font-size: 16px;
      line-height: 24px;
      color: var(--devui-title-text);
    }
    .icon-close {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 24px;
      height: 24px;
      color: var(--devui-icon);
      border-radius: 8px;
      transition:
        background-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth,
        color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
      cursor: pointer;

      &:hover {
        color: var(--devui-title-text);
        background-color: var(--devui-input-hover-bg);
      }
    }
  }

  .custom-sort-modal-content {
    padding: 0 20px;
    max-height: 400px;
    overflow: auto;
  }

  .custom-sort-rule {
    font-weight: bold;
    font-size: 14px;
    line-height: 22px;
    color: var(--devui-title-text);
  }

  .custom-sort-item {
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 8px;
    padding: 12px;
    margin-top: 16px;
    box-sizing: border-box;
    background-color: var(--devui-input-disabled-bg);
    .icon {
      font-size: 16px;
    }
    .drag-handle {
      cursor: grab;
    }
    .icon-delete {
      cursor: pointer;
    }
    .custom-sort-config {
      flex: 1;
      :deep() {
        .devui-select__selection {
          border-color: transparent;
          background-color: var(--devui-nest-bg);
          &:hover {
            border-color: var(--devui-operation-text-hover);
          }
        }
        .devui-select--open .devui-select__selection {
          border-color: var(--devui-operation-text-hover);
        }
      }
    }
  }

  .add-column {
    display: flex;
    align-items: center;
    gap: 4px;
    width: fit-content;
    margin-top: 16px;
    font-size: 13px;
    color: var(--devui-secondary-text);
    cursor: pointer;
    &.add-column-disabled {
      color: var(--devui-disabled-text);
      cursor: not-allowed;
    }

    i {
      font-size: 16px;
    }
    span {
      line-height: 20px;
    }
  }

  .custom-sort-modal-btn-wrap {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
    padding: 0 20px;
    .cancel-button,
    .confirm-button {
      height: 28px;
      border-radius: 8px;
      padding: 0 24px;
      :deep() {
        .button-content {
          color: var(--devui-primary-text);
          font-size: 13px;
          line-height: 22px;
        }
      }
      &:disabled {
        background-color: var(--devui-primary-button-disabled-bg);
        :deep() {
          .button-content {
            color: var(--devui-primary-text-weak);
          }
        }
      }
    }
    .cancel-button {
      background-color: var(--devui-button-group-bg);
    }
    .confirm-button {
      background-color: var(--devui-primary-button-bg);
    }
  }
}
</style>
