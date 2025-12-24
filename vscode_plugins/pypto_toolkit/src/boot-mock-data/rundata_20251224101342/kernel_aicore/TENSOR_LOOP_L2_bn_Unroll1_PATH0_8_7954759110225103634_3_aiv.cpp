#include "TileOpImpl.h"

// funcHash: 17630336457827800367

extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_3_18014398509481984(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam) {
float __ubuf__ *UB_S0_E1024 = (float __ubuf__ *)get_imm(0x0); // size: 0x400
float __ubuf__ *UB_S9216_E17408 = (float __ubuf__ *)get_imm(0x2400); // size: 0x2000
float __ubuf__ *UB_S1024_E9216 = (float __ubuf__ *)get_imm(0x400); // size: 0x2000
bfloat16_t __ubuf__ *UB_S17408_E21504 = (bfloat16_t __ubuf__ *)get_imm(0x4400); // size: 0x1000
SUBKERNEL_PHASE1
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__ubuf__ float*)UB_S0_E1024, (__gm__ float*)GET_PARAM_ADDR(param, 0, 1), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 0, 1), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 1, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 1, 1)));
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID0);
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__ubuf__ float*)UB_S9216_E17408, (__gm__ float*)GET_PARAM_ADDR(param, 1, 10), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 1, 10), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 10, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 10, 1)));
SUBKERNEL_PHASE2
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID1);
set_flag(PIPE_MTE2, PIPE_MTE3, EVENT_ID0);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID0);
TileOp::Texpand_<float, 1, 1, 32, 64, 1, 1, 32, 1, /*DS*/ 1, 32, 64, /*SS*/ 1, 32, 8, 3>((__ubuf__ float*)UB_S1024_E9216, (__ubuf__ float*)UB_S0_E1024);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID1);
pipe_barrier(PIPE_V);
TileOp::Tsub_<float, /*OS0*/ 1, 1, 32, 64, /*OS1*/ 1, 1, 32, 64, /*DS*/ 1, 1, 32, 64, /*S0*/ 1, 1, 32, 64, /*S1*/ 1, 1, 32, 64>((__ubuf__ float*)UB_S9216_E17408, (__ubuf__ float*)UB_S9216_E17408, (__ubuf__ float*)UB_S1024_E9216);
pipe_barrier(PIPE_V);
TileOp::Texp_<float, /*OS*/ 1, 1, 32, 64, /*DS*/ 1, 32, 64, /*SS*/ 1, 32, 64>((__ubuf__ float*)UB_S9216_E17408, (__ubuf__ float*)UB_S9216_E17408);
set_flag(PIPE_V, PIPE_MTE3, EVENT_ID0);
pipe_barrier(PIPE_V);
TileOp::Tcast_<bfloat16_t, float, 1, 1, 32, 64, 1, 32, 64, 1, 32, 64 , 0>((__ubuf__ bfloat16_t *)UB_S17408_E21504,  (__ubuf__ float *)UB_S9216_E17408);
set_flag(PIPE_V, PIPE_MTE3, EVENT_ID1);
wait_flag(PIPE_V, PIPE_MTE3, EVENT_ID0);
wait_flag(PIPE_MTE2, PIPE_MTE3, EVENT_ID0);
TileOp::DynUBCopyOut<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__gm__ float*)GET_PARAM_ADDR(param, 3, 28), (__ubuf__ float*)UB_S9216_E17408, 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 3, 28), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 28, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 28, 1)));
wait_flag(PIPE_V, PIPE_MTE3, EVENT_ID1);
TileOp::DynUBCopyOut<bfloat16_t, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 2, 19), (__ubuf__ bfloat16_t*)UB_S17408_E21504, 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 2, 19), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 19, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 19, 1)));
}
