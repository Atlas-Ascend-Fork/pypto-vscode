#define __TILE_FWK_AICPU__ 1
#include <stdint.h>
#include "expression_0.h"
#include "tilefwk/aicore_data.h"
#include "tilefwk/aicpu_runtime.h"
#include "tilefwk/aicpu_distributed.h"
#define LOOP(idx, b, e, s) for (uint64_t idx = (b), idxEnd = (e), idxStep = (s); idx < idxEnd; idx += idxStep)
namespace npu::tile_fwk {
// #name:TENSOR_main #hash:6316281875383642747 #magic:2
__attribute__((section("ast2")))
uint64_t ControlFlowEntry(void *ctx, uint64_t *symbolTable, CallRootEntryType callRootList[3], DevStartArgsBase *startArgs) {
  // hash=8578720118107992813
  LOOP(VAR_bIdx, 0, 4, 1) {
    VALUE_bIdx = VAR_bIdx;
    // #name:TENSOR_LOOP_L0_bIdx_Unroll1_PATH0 #hash:1938764483364920178 #magic:4
      // hash=11500810263143031361
      LOOP(VAR_nIdx, 0, 1, 1) {
        VALUE_nIdx = VAR_nIdx;
        // #name:TENSOR_LOOP_L1_nIdx_Unroll1_PATH0 #hash:7976461649267122320 #magic:6
          // hash=6610993561617135527
          LOOP(VAR_bn, 0, ((((((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) + 128) - 1) / 128) / 1) * 1), 1) {
            VALUE_bn = VAR_bn;
            if ((RUNTIME_IsLoopBegin(VALUE_bn, 0))) {
              if ((RUNTIME_IsLoopEnd(VALUE_bn, (((((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) + 128) - 1) / 128) - 1)))) {
                // #name:TENSOR_LOOP_L2_bn_Unroll1_PATH3 #hash:6345291426035161494 #magic:11
                // #name:TENSOR_LOOP_L2_bn_Unroll1_PATH3_root #hash:15923165481660127623 #magic:55
                uint64_t *exprList3 = (uint64_t *)callRootList[CallRootStage::T_CALLROOT_ALLOC](ctx, 3ULL);
                exprList3[0] = ARG_actSeqs;
                exprList3[1] = ARG_blockTable;
                exprList3[2] = 0;
                exprList3[3] = 0;
                exprList3[4] = 0;
                exprList3[5] = 0;
                exprList3[6] = 0;
                exprList3[7] = VALUE_bIdx;
                exprList3[8] = VALUE_bn;
                exprList3[9] = VALUE_nIdx;
                exprList3[10] = (((RUNTIME_GetInputDataInt32Dim2(ARG_blockTable, VALUE_bIdx, VALUE_bn)) * 128) + 64);
                exprList3[11] = ((RUNTIME_GetInputDataInt32Dim2(ARG_blockTable, VALUE_bIdx, VALUE_bn)) * 128);
                exprList3[12] = ((VALUE_bIdx * 32) + (VALUE_nIdx * 32));
                exprList3[13] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 64)), 0, 64));
                exprList3[14] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 64, 64)), 0, 64));
                exprList3[15] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim(128, ((VALUE_bIdx * 32) + (VALUE_nIdx * 32)), 32)), 0, 32));
                exprList3[16] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 128));
                exprList3[17] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 64));
                exprList3[18] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 64, 64));
                callRootList[CallRootStage::T_CALLROOT_STITCH](ctx, 3ULL);
              } else {
                // #name:TENSOR_LOOP_L2_bn_Unroll1_PATH2 #hash:12895447651169499376 #magic:10
                // #name:TENSOR_LOOP_L2_bn_Unroll1_PATH2_root #hash:746860275674524290 #magic:46
                uint64_t *exprList2 = (uint64_t *)callRootList[CallRootStage::T_CALLROOT_ALLOC](ctx, 2ULL);
                exprList2[0] = ARG_actSeqs;
                exprList2[1] = ARG_blockTable;
                exprList2[2] = 0;
                exprList2[3] = 0;
                exprList2[4] = 0;
                exprList2[5] = 0;
                exprList2[6] = 0;
                exprList2[7] = VALUE_bIdx;
                exprList2[8] = VALUE_bn;
                exprList2[9] = VALUE_nIdx;
                exprList2[10] = (((RUNTIME_GetInputDataInt32Dim2(ARG_blockTable, VALUE_bIdx, VALUE_bn)) * 128) + 64);
                exprList2[11] = ((RUNTIME_GetInputDataInt32Dim2(ARG_blockTable, VALUE_bIdx, VALUE_bn)) * 128);
                exprList2[12] = ((VALUE_bIdx * 32) + (VALUE_nIdx * 32));
                exprList2[13] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 64)), 0, 64));
                exprList2[14] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 64, 64)), 0, 64));
                exprList2[15] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim(128, ((VALUE_bIdx * 32) + (VALUE_nIdx * 32)), 32)), 0, 32));
                exprList2[16] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 128));
                exprList2[17] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 64));
                exprList2[18] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 64, 64));
                callRootList[CallRootStage::T_CALLROOT_STITCH](ctx, 2ULL);
              }
            } else {
              if ((RUNTIME_IsLoopEnd(VALUE_bn, (((((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) + 128) - 1) / 128) - 1)))) {
                // #name:TENSOR_LOOP_L2_bn_Unroll1_PATH1 #hash:4008488609558567838 #magic:9
                // #name:TENSOR_LOOP_L2_bn_Unroll1_PATH1_root #hash:9928535964290202028 #magic:29
                uint64_t *exprList1 = (uint64_t *)callRootList[CallRootStage::T_CALLROOT_ALLOC](ctx, 1ULL);
                exprList1[0] = ARG_actSeqs;
                exprList1[1] = ARG_blockTable;
                exprList1[2] = 0;
                exprList1[3] = 0;
                exprList1[4] = 0;
                exprList1[5] = 0;
                exprList1[6] = 0;
                exprList1[7] = VALUE_bIdx;
                exprList1[8] = VALUE_bn;
                exprList1[9] = VALUE_nIdx;
                exprList1[10] = (((RUNTIME_GetInputDataInt32Dim2(ARG_blockTable, VALUE_bIdx, VALUE_bn)) * 128) + 64);
                exprList1[11] = ((RUNTIME_GetInputDataInt32Dim2(ARG_blockTable, VALUE_bIdx, VALUE_bn)) * 128);
                exprList1[12] = ((VALUE_bIdx * 32) + (VALUE_nIdx * 32));
                exprList1[13] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 64)), 0, 64));
                exprList1[14] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 64, 64)), 0, 64));
                exprList1[15] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim(128, ((VALUE_bIdx * 32) + (VALUE_nIdx * 32)), 32)), 0, 32));
                exprList1[16] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 128));
                exprList1[17] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 64));
                exprList1[18] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 64, 64));
                callRootList[CallRootStage::T_CALLROOT_STITCH](ctx, 1ULL);
              } else {
                // #name:TENSOR_LOOP_L2_bn_Unroll1_PATH0 #hash:7954759110225103634 #magic:8
                // #name:TENSOR_LOOP_L2_bn_Unroll1_PATH0_root #hash:3468838780141898342 #magic:12
                uint64_t *exprList0 = (uint64_t *)callRootList[CallRootStage::T_CALLROOT_ALLOC](ctx, 0ULL);
                exprList0[0] = ARG_actSeqs;
                exprList0[1] = ARG_blockTable;
                exprList0[2] = 0;
                exprList0[3] = 0;
                exprList0[4] = 0;
                exprList0[5] = 0;
                exprList0[6] = 0;
                exprList0[7] = VALUE_bIdx;
                exprList0[8] = VALUE_bn;
                exprList0[9] = VALUE_nIdx;
                exprList0[10] = (((RUNTIME_GetInputDataInt32Dim2(ARG_blockTable, VALUE_bIdx, VALUE_bn)) * 128) + 64);
                exprList0[11] = ((RUNTIME_GetInputDataInt32Dim2(ARG_blockTable, VALUE_bIdx, VALUE_bn)) * 128);
                exprList0[12] = ((VALUE_bIdx * 32) + (VALUE_nIdx * 32));
                exprList0[13] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 64)), 0, 64));
                exprList0[14] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 64, 64)), 0, 64));
                exprList0[15] = (RUNTIME_GetViewValidShapeDim((RUNTIME_GetViewValidShapeDim(128, ((VALUE_bIdx * 32) + (VALUE_nIdx * 32)), 32)), 0, 32));
                exprList0[16] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 128));
                exprList0[17] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 0, 64));
                exprList0[18] = (RUNTIME_GetViewValidShapeDim((RUNTIME_Min(((RUNTIME_GetInputDataInt32Dim1(ARG_actSeqs, VALUE_bIdx)) - (VALUE_bn * 128)), 128)), 64, 64));
                callRootList[CallRootStage::T_CALLROOT_STITCH](ctx, 0ULL);
              }
            }
          }
      }
  }
  callRootList[CallRootStage::T_CALLROOT_STITCH](ctx, RUNTIME_FINISH_FUNCKEY); // Notify finish 
  return 0;
}
} // namespace npu::tile_fwk
