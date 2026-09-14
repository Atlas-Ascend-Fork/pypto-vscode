<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 -->
<template>
  <div :class="['statistic-card', type, { active: activeType === type,clickable: clickable }]" @click="handleCard">
    <div class="text-wrap">
      <div class="title">
        <span>{{ type }}</span>
        <d-tooltip overlay-class="com-graph-report-standard-tips" :position="['top', 'top-start', 'top-end']">
          <i class="icon icon-helping"></i>
          <template #content>
            <span>{{ t(`controlFlows.accuracyVerificationResultsTips.${type}`) }}</span>
          </template>
        </d-tooltip>
      </div>
      <div :class="['count', type]">{{ count }}</div>
    </div>
    <div class="icon-wrap">
      <div v-if="type === 'FAIL'" class="fail-icon-wrap">
        <i class="icon icon-error"></i>
      </div>
      <div v-if="type === 'PASS'" class="pass-icon-wrap">
        <i class="icon icon-right"></i>
      </div>
      <div v-if="type === 'SKIP'" class="skip-icon-wrap">
        <i class="icon icon-forbidding"></i>
      </div>
      <div v-if="type === 'EXCEPTION'" class="warning-icon-wrap">
        <svg width="32" height="32" viewBox="-8 -8 48 48">
          <polygon stroke-linejoin="round" points="16,0 0,32 32,32"></polygon>
        </svg>
        <i class="icon icon-warning"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const props = defineProps({
  type: String,
  count: Number,
  activeType: String,
  clickable: {
    type: Boolean,
    default: true
  }
});

const emits = defineEmits(['handleCard'])
const handleCard = () => {
  emits('handleCard', props.type)
}
</script>

<style lang="scss" scoped>
@mixin card-bg-style($r, $g, $b) {
    background: linear-gradient(206.57deg, rgba($r, $g, $b, 0.05), rgba($r, $g, $b, 0) 100%),var(--benchmark-footer-bg);

    &.active {
      border-color: rgba($r, $g, $b, 1);
    }
}

@mixin icon-wrap-base($r, $g, $b, $radius: 100%) {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
  border-radius: $radius;
  background-color: rgba($r, $g, $b, 0.2);

  i {
    font-size: 20px;
    color: rgba($r, $g, $b, 1);
  }
}

.statistic-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  height: 90px;
  padding: 16px;
  margin-bottom: 8px;
  border-radius: 12px;
  min-width: 0;

  &.clickable {
    cursor: pointer;
  }

  &.active {
    border: 2px solid;
  }

  &.FAIL {
    @include card-bg-style(246, 158, 57);
  }

  &.SKIP {
    @include card-bg-style(179, 179, 179);
  }

  &.EXCEPTION {
    @include card-bg-style(231, 67, 74);
  }

  &.PASS {
    @include card-bg-style(135, 200, 89);
  }

  .text-wrap {
    display: flex;
    flex-direction: column;
    color: var(--devui-primary-text);
    height: 100%;
    justify-content: space-between;
    flex: 1;
    min-width: 0;

    .title {
      font-size: 12px;
      word-break: break-word;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .count {
      font-size: 24px;
      height: 32px;
      line-height: 32px;

      &.FAIL {
        color: rgba(246, 158, 57, 1);
      }

      &.SKIP {
        color: rgba(179,179, 179, 1);
      }

      &.EXCEPTION {
        color: rgba(231, 67, 74, 1);
      }

      &.PASS {
        color: rgba(135, 200, 89, 1);
      }
    }
  }

  .icon-wrap {
    flex-shrink: 0;

    .fail-icon-wrap {
      @include icon-wrap-base(246, 158, 57);
    }

    .pass-icon-wrap {
      @include icon-wrap-base(135, 200, 89);
    }

    .skip-icon-wrap {
      @include icon-wrap-base(179, 179, 179, 25%);
    }

    .warning-icon-wrap {
      position: relative;

      svg {
        fill: rgba(231, 67, 74, 1);
        stroke: rgba(231, 67, 74, 1);
        stroke-width: 10;
        opacity: 0.2;
      }

      i {
        position: absolute;
        top: calc(50% - 7px);
        left: calc(50% - 10px);
        font-size: 20px;
        color: rgba(231, 67, 74, 1);
      }
    }
  }
}
</style>

