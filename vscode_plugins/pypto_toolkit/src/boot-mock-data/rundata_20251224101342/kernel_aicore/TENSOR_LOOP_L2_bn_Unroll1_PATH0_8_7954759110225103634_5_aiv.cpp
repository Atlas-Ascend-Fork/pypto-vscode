#include "TileOpImpl.h"

// funcHash: 8427956571998214713

extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_5_27021597764222976(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam) {
float __ubuf__ *UB_S0_E8192 = (float __ubuf__ *)get_imm(0x0); // size: 0x2000
float __ubuf__ *UB_S8192_E16384 = (float __ubuf__ *)get_imm(0x2000); // size: 0x2000
float __ubuf__ *UB_S25632_E26656 = (float __ubuf__ *)get_imm(0x6420); // size: 0x400
float __ubuf__ *UB_S26656_E27680 = (float __ubuf__ *)get_imm(0x6820); // size: 0x400
float __ubuf__ *UB_S16384_E24576 = (float __ubuf__ *)get_imm(0x4000); // size: 0x2000
float __ubuf__ *UB_S24576_E25600 = (float __ubuf__ *)get_imm(0x6000); // size: 0x400
float __ubuf__ *UB_S25600_E25632 = (float __ubuf__ *)get_imm(0x6400); // size: 0x20
SUBKERNEL_PHASE1
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__ubuf__ float*)UB_S0_E8192, (__gm__ float*)GET_PARAM_ADDR(param, 1, 10), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 1, 10), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 10, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 10, 1)));
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__ubuf__ float*)UB_S8192_E16384, (__gm__ float*)GET_PARAM_ADDR(param, 0, 1), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 0, 1), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 1, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 1, 1)));
SUBKERNEL_PHASE2
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID0);
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__ubuf__ float*)UB_S25632_E26656, (__gm__ float*)GET_PARAM_ADDR(param, 2, 19), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 2, 19), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 19, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 19, 1)));
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID1);
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__ubuf__ float*)UB_S26656_E27680, (__gm__ float*)GET_PARAM_ADDR(param, 3, 28), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 3, 28), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 28, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 28, 1)));
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID2);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID0);
TileOp::Taddpair_<float, /*OS0*/ 1, 1, 32, 64, /*OS1*/ 1, 1, 32, 64, /*DS*/ 1, 1, 32, 64, /*S0*/ 1, 1, 32, 64, /*S1*/ 1, 1, 32, 64>((__ubuf__ float*)UB_S16384_E24576, (__ubuf__ float*)UB_S0_E8192, (__ubuf__ float*)UB_S8192_E16384);
pipe_barrier(PIPE_V);
TileOp::Trowsumsingle_<float, 1, 1, 32, 64, 1, 32, 8, 1, 32, 64, 8>((__ubuf__ float *)UB_S24576_E25600, (__ubuf__ float *)UB_S16384_E24576, (__ubuf__ float *)UB_S25600_E25632);
pipe_barrier(PIPE_V);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID1);
TileOp::Tmul_<float, /*OS0*/ 1, 1, 32, 1, /*OS1*/ 1, 1, 32, 1, /*DS*/ 1, 1, 32, 8, /*S0*/ 1, 1, 32, 8, /*S1*/ 1, 1, 32, 8>((__ubuf__ float*)UB_S25632_E26656, (__ubuf__ float*)UB_S25632_E26656, (__ubuf__ float*)UB_S24576_E25600);
pipe_barrier(PIPE_V);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID2);
TileOp::Tadd_<float, /*OS0*/ 1, 1, 32, 1, /*OS1*/ 1, 1, 32, 1, /*DS*/ 1, 1, 32, 8, /*S0*/ 1, 1, 32, 8, /*S1*/ 1, 1, 32, 8>((__ubuf__ float*)UB_S26656_E27680, (__ubuf__ float*)UB_S26656_E27680, (__ubuf__ float*)UB_S25632_E26656);
set_flag(PIPE_V, PIPE_MTE3, EVENT_ID0);
wait_flag(PIPE_V, PIPE_MTE3, EVENT_ID0);
TileOp::DynUBCopyOut<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__gm__ float*)GET_PARAM_ADDR(param, 4, 37), (__ubuf__ float*)UB_S26656_E27680, 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 4, 37), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 37, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 37, 1)));
}
