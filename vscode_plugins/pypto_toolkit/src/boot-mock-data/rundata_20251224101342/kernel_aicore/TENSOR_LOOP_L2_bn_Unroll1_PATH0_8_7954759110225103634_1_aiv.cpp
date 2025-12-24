#include "TileOpImpl.h"

// funcHash: 1170777262654197941

extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_1_9007199254740992(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam) {
float __ubuf__ *UB_S0_E8192 = (float __ubuf__ *)get_imm(0x0); // size: 0x2000
SUBKERNEL_PHASE1
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__ubuf__ float*)UB_S0_E8192, (__gm__ float*)GET_PARAM_ADDR(param, 0, 1), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 0, 1), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 1, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 1, 1)));
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID0);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID0);
SUBKERNEL_PHASE2
TileOp::Tmuls_<float, 1, 1, 32, 64, /*DS*/ 1, 32, 64, /*S0S*/ 1, 32, 64>((__ubuf__ float*)UB_S0_E8192, (__ubuf__ float*)UB_S0_E8192, (float)0.0416666679);
set_flag(PIPE_V, PIPE_MTE3, EVENT_ID0);
wait_flag(PIPE_V, PIPE_MTE3, EVENT_ID0);
TileOp::DynUBCopyOut<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__gm__ float*)GET_PARAM_ADDR(param, 1, 10), (__ubuf__ float*)UB_S0_E8192, 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 1, 10), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 10, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 10, 1)));
}
