#include "TileOpImpl.h"

// funcHash: 4477315326097980598

extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH1_9_0_36028797018963968(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam) {
float __ubuf__ *UB_S0_E8192 = (float __ubuf__ *)get_imm(0x0); // size: 0x2000
float __ubuf__ *UB_S8192_E16384 = (float __ubuf__ *)get_imm(0x2000); // size: 0x2000
float __ubuf__ *UB_S33792_E34816 = (float __ubuf__ *)get_imm(0x8400); // size: 0x400
float __ubuf__ *UB_S36864_E37888 = (float __ubuf__ *)get_imm(0x9000); // size: 0x400
float __ubuf__ *UB_S16384_E24576 = (float __ubuf__ *)get_imm(0x4000); // size: 0x2000
float __ubuf__ *UB_S24576_E25600 = (float __ubuf__ *)get_imm(0x6000); // size: 0x400
float __ubuf__ *UB_S25600_E33792 = (float __ubuf__ *)get_imm(0x6400); // size: 0x2000
float __ubuf__ *UB_S34816_E35840 = (float __ubuf__ *)get_imm(0x8800); // size: 0x400
float __ubuf__ *UB_S35840_E36864 = (float __ubuf__ *)get_imm(0x8c00); // size: 0x400
float __ubuf__ *UB_S37888_E38912 = (float __ubuf__ *)get_imm(0x9400); // size: 0x400
SUBKERNEL_PHASE1
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__ubuf__ float*)UB_S0_E8192, (__gm__ float*)GET_PARAM_ADDR(param, 1, 10), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 1, 10), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 10, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 10, 1)));
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__ubuf__ float*)UB_S8192_E16384, (__gm__ float*)GET_PARAM_ADDR(param, 0, 1), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 0, 1), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 1, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 1, 1)));
SUBKERNEL_PHASE2
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID0);
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__ubuf__ float*)UB_S33792_E34816, (__gm__ float*)GET_PARAM_ADDR(param, 2, 19), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 2, 19), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 19, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 19, 1)));
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID1);
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__ubuf__ float*)UB_S36864_E37888, (__gm__ float*)GET_PARAM_ADDR(param, 3, 28), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 3, 28), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 28, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 28, 1)));
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID2);
set_flag(PIPE_MTE2, PIPE_MTE3, EVENT_ID0);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID0);
TileOp::Tmaxpair_<float, /*OS0*/ 1, 1, 32, 64, /*OS1*/ 1, 1, 32, 64, /*DS*/ 1, 1, 32, 64, /*S0*/ 1, 1, 32, 64, /*S1*/ 1, 1, 32, 64>((__ubuf__ float*)UB_S16384_E24576, (__ubuf__ float*)UB_S0_E8192, (__ubuf__ float*)UB_S8192_E16384);
pipe_barrier(PIPE_V);
TileOp::Trowmaxsingle_<float, 1, 1, 32, 64, 1, 32, 8, 1, 32, 64, 64>((__ubuf__ float *)UB_S24576_E25600, (__ubuf__ float *)UB_S16384_E24576, (__ubuf__ float *)UB_S25600_E33792);
set_flag(PIPE_V, PIPE_MTE3, EVENT_ID0);
pipe_barrier(PIPE_V);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID1);
TileOp::Tmax_<float, /*OS0*/ 1, 1, 32, 1, /*OS1*/ 1, 1, 32, 1, /*DS*/ 1, 1, 32, 8, /*S0*/ 1, 1, 32, 8, /*S1*/ 1, 1, 32, 8>((__ubuf__ float*)UB_S34816_E35840, (__ubuf__ float*)UB_S33792_E34816, (__ubuf__ float*)UB_S24576_E25600);
set_flag(PIPE_V, PIPE_MTE3, EVENT_ID1);
pipe_barrier(PIPE_V);
TileOp::Tsub_<float, /*OS0*/ 1, 1, 32, 1, /*OS1*/ 1, 1, 32, 1, /*DS*/ 1, 1, 32, 8, /*S0*/ 1, 1, 32, 8, /*S1*/ 1, 1, 32, 8>((__ubuf__ float*)UB_S35840_E36864, (__ubuf__ float*)UB_S33792_E34816, (__ubuf__ float*)UB_S34816_E35840);
pipe_barrier(PIPE_V);
TileOp::Texp_<float, /*OS*/ 1, 1, 32, 1, /*DS*/ 1, 32, 8, /*SS*/ 1, 32, 8>((__ubuf__ float*)UB_S35840_E36864, (__ubuf__ float*)UB_S35840_E36864);
set_flag(PIPE_V, PIPE_MTE3, EVENT_ID2);
pipe_barrier(PIPE_V);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID2);
TileOp::Tmul_<float, /*OS0*/ 1, 1, 32, 1, /*OS1*/ 1, 1, 32, 1, /*DS*/ 1, 1, 32, 8, /*S0*/ 1, 1, 32, 8, /*S1*/ 1, 1, 32, 8>((__ubuf__ float*)UB_S36864_E37888, (__ubuf__ float*)UB_S35840_E36864, (__ubuf__ float*)UB_S36864_E37888);
set_flag(PIPE_V, PIPE_MTE3, EVENT_ID3);
TileOp::Tsub_<float, /*OS0*/ 1, 1, 32, 1, /*OS1*/ 1, 1, 32, 1, /*DS*/ 1, 1, 32, 8, /*S0*/ 1, 1, 32, 8, /*S1*/ 1, 1, 32, 8>((__ubuf__ float*)UB_S37888_E38912, (__ubuf__ float*)UB_S24576_E25600, (__ubuf__ float*)UB_S34816_E35840);
pipe_barrier(PIPE_V);
TileOp::Texp_<float, /*OS*/ 1, 1, 32, 1, /*DS*/ 1, 32, 8, /*SS*/ 1, 32, 8>((__ubuf__ float*)UB_S37888_E38912, (__ubuf__ float*)UB_S37888_E38912);
set_flag(PIPE_V, PIPE_MTE3, EVENT_ID4);
wait_flag(PIPE_V, PIPE_MTE3, EVENT_ID0);
TileOp::DynUBCopyOut<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__gm__ float*)GET_PARAM_ADDR(param, 4, 37), (__ubuf__ float*)UB_S24576_E25600, 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 4, 37), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 37, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 37, 1)));
wait_flag(PIPE_V, PIPE_MTE3, EVENT_ID1);
TileOp::DynUBCopyOut<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__gm__ float*)GET_PARAM_ADDR(param, 8, 73), (__ubuf__ float*)UB_S34816_E35840, 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 8, 73), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 73, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 73, 1)));
wait_flag(PIPE_V, PIPE_MTE3, EVENT_ID2);
TileOp::DynUBCopyOut<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__gm__ float*)GET_PARAM_ADDR(param, 7, 64), (__ubuf__ float*)UB_S35840_E36864, 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 7, 64), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 64, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 64, 1)));
wait_flag(PIPE_V, PIPE_MTE3, EVENT_ID3);
wait_flag(PIPE_MTE2, PIPE_MTE3, EVENT_ID0);
TileOp::DynUBCopyOut<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__gm__ float*)GET_PARAM_ADDR(param, 6, 55), (__ubuf__ float*)UB_S36864_E37888, 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 6, 55), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 55, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 55, 1)));
wait_flag(PIPE_V, PIPE_MTE3, EVENT_ID4);
TileOp::DynUBCopyOut<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__gm__ float*)GET_PARAM_ADDR(param, 5, 46), (__ubuf__ float*)UB_S37888_E38912, 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 5, 46), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 46, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 46, 1)));
}
