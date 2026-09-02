<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 -->
<template>
  <div class="flow-chart">
    <div class="dashed-box left-box"></div>
    <div class="dashed-box right-box">
      <div class="top-area">
        <div class="start-row">
          <StorageUnit
            :width="88"
            :height="134"
            badge-text="L1"
            :type="memory.MEM_L1_Average_Usage === 0 && memory.MEM_L1_Peak_Usage === 0 ? 'no-data' : 'has-data'"
            :titles="['Avg.', 'Peak']"
            :counts="[formateNum(memory.MEM_L1_Average_Usage), formateNum(memory.MEM_L1_Peak_Usage)]"
          />
          <div class="arrow-box">
            <ArrowItem type="right" class="first-arrow" />
            <ArrowItem type="right" class="second-arrow" />
          </div>
          <div class="middle-area">
            <StorageUnit
              :width="88"
              :height="63"
              badge-text="L0A"
              :type="memory.MEM_L0A_Average_Usage === 0 && memory.MEM_L0A_Peak_Usage === 0 ? 'no-data' : 'has-data'"
              :titles="['Avg.', 'Peak']"
              :counts="[formateNum(memory.MEM_L0A_Average_Usage), formateNum(memory.MEM_L0A_Peak_Usage)]"
            />
            <StorageUnit
              :width="88"
              :height="63"
              badge-text="L0B"
              :type="memory.MEM_L0B_Average_Usage === 0 && memory.MEM_L0B_Peak_Usage === 0 ? 'no-data' : 'has-data'"
              :titles="['Avg.', 'Peak']"
              :counts="[formateNum(memory.MEM_L0B_Average_Usage), formateNum(memory.MEM_L0B_Peak_Usage)]"
            />
          </div>
          <div class="arrow-box">
            <ArrowItem type="right" class="first-arrow" />
            <ArrowItem type="right" class="second-arrow" />
          </div>
          <div class="end-area">
            <CalcUnit
              :width="88"
              :height="96"
              badge-text="CUBE"
              title="PIPE_M"
              :type="maxPipe === 'PIPE_M' ? 'warning' : pipe.PIPE_M_Usage_Rate === 0 ? 'no-data' : 'has-data'"
              :count="formateNum(pipe.PIPE_M_Usage_Rate)"
            />
            <ArrowItem direction="vertical" type="right" class="end-area-arrow" />
            <StorageUnit
              :width="88"
              :height="63"
              badge-text="L0C"
              :type="memory.MEM_L0C_Average_Usage === 0 && memory.MEM_L0C_Peak_Usage === 0 ? 'no-data' : 'has-data'"
              :titles="['Avg.', 'Peak']"
              :counts="[formateNum(memory.MEM_L0C_Average_Usage), formateNum(memory.MEM_L0C_Peak_Usage)]"
            />
          </div>
        </div>
        <div class="end-row">
          <CalcUnit
            :width="88"
            :height="63"
            badge-text="Scalar"
            title="PIPE_V"
            :type="maxPipe === 'PIPE_V' ? 'warning' : pipe.PIPE_V_Usage_Rate === 0 ? 'no-data' : 'has-data'"
            :count="formateNum(pipe.PIPE_V_Usage_Rate)"
          />
          <FlowWater
            title="PIPE_MTE1"
            :type="maxPipe === 'PIPE_MTE1' ? 'warning' : pipe.PIPE_MTE1_Usage_Rate === 0 ? 'no-data' : 'has-data'"
            :count="formateNum(pipe.PIPE_MTE1_Usage_Rate)"
          />
          <FlowWater
            arrow-type="left"
            :type="maxPipe === 'PIPE_FIX' ? 'warning' : pipe.PIPE_FIX_Usage_Rate === 0 ? 'no-data' : 'has-data'"
            title="PIPE_FIX"
            :count="formateNum(pipe.PIPE_FIX_Usage_Rate)"
          />
        </div>
      </div>
      <div class="bottom-area">
        <div class="start-row">
          <StorageUnit
            :width="140"
            :height="63"
            badge-text="UB"
            :type="memory.MEM_UB_Average_Usage === 0 && memory.MEM_UB_Peak_Usage === 0 ? 'no-data' : 'has-data'"
            :titles="['Avg.', 'Peak']"
            :counts="[formateNum(memory.MEM_UB_Average_Usage), formateNum(memory.MEM_UB_Peak_Usage)]"
          />
          <ArrowItem direction="horizontal" type="both" />
          <CalcUnit
            :width="140"
            :height="63"
            badge-text="Vector"
            title="PIPE_V"
            :type="maxPipe === 'PIPE_V' ? 'warning' : pipe.PIPE_V_Usage_Rate === 0 ? 'no-data' : 'has-data'"
            :count="formateNum(pipe.PIPE_V_Usage_Rate)"
          />
        </div>
        <ArrowItem direction="vertical" type="both" class="vertical-arrow" />
        <CalcUnit
          :width="140"
          :height="63"
          badge-text="Scalar"
          title="PIPE_S"
          ::type="maxPipe === 'PIPE_S' ? 'warning' : pipe.PIPE_S_Usage_Rate === 0 ? 'no-data' : 'has-data'"
          :count="formateNum(pipe.PIPE_S_Usage_Rate)"
        />
      </div>
    </div>
    <div class="float-box">
      <FlowWater
        title="PIPE_MTE2"
        :type="maxPipe === 'PIPE_MTE2' ? 'warning' : pipe.PIPE_MTE2_Usage_Rate === 0 ? 'no-data' : 'has-data'"
        :count="formateNum(pipe.PIPE_MTE2_Usage_Rate)"
        class="PIPE_MTE2"
      />
      <FlowWater
        arrow-type="left"
        title="PIPE_MTE3"
        :type="maxPipe === 'PIPE_MTE3' ? 'warning' : pipe.PIPE_MTE3_Usage_Rate === 0 ? 'no-data' : 'has-data'"
        :count="formateNum(pipe.PIPE_MTE3_Usage_Rate)"
        class="PIPE_MTE3"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import StorageUnit from './storageUnit.vue';
import CalcUnit from './calcUnit.vue';
import FlowWater from './flowWater.vue';
import ArrowItem from './arrowItem.vue';
import { formateNum } from './utils';

defineProps({
  pipe: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({}),
  },
  memory: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({}),
  },
  maxPipe: String,
});
</script>

<style scoped lang="scss">
.flow-chart {
  position: relative;
  display: flex;
  gap: 8px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--devui-split-line);

  .dashed-box {
    height: 476px;
    border: 1px dashed var(--devui-disabled-text);
    border-radius: 12px;
    box-sizing: border-box;
  }

  .left-box {
    width: 50px;
  }

  .right-box {
    width: 390px;
    padding-top: 16px;
    padding-left: 52px;
    box-sizing: border-box;

    .top-area,
    .bottom-area {
      width: 321px;
      padding: 12px;
      border-radius: 8px;
      background-color: var(--devui-flow-chart-nest-bg);
      box-sizing: border-box;
    }

    .top-area {
      margin-bottom: 12px;
      .start-row {
        display: flex;
        margin-bottom: 8px;
        .arrow-box {
          .first-arrow {
            margin-top: 28px;
          }
          .second-arrow {
            margin-top: 43px;
          }
        }
        .middle-area {
          display: flex;
          flex-flow: column;
          gap: 8px;
        }
        .end-area {
          display: flex;
          flex-direction: column;
          align-items: center;

          .end-area-arrow {
            padding: 4px 0;
          }
        }
      }

      .end-row {
        display: flex;
        justify-content: space-between;
      }
    }

    .bottom-area {
      .start-row {
        display: flex;
      }
      .vertical-arrow {
        margin-top: 4px;
        margin-left: 62px;
        margin-bottom: 4px;
      }
    }
  }

  .float-box {
    position: absolute;
    top: 169px;
    left: 12px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 12px;

    .PIPE_MTE2,.PIPE_MTE3 {
      &.warning {
        margin-left: -2px;
      }
    }
  }
}
</style>
