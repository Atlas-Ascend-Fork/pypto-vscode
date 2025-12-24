#include "TileOpImpl.h"

// funcHash: 1231527610565308428

extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH1_9_3_49539595901075456(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam) {
float __ubuf__ *UB_S0_E1024 = (float __ubuf__ *)get_imm(0x0); // size: 0x400
float __ubuf__ *UB_S9216_E17408 = (float __ubuf__ *)get_imm(0x2400); // size: 0x2000
float __ubuf__ *UB_S17408_E18432 = (float __ubuf__ *)get_imm(0x4400); // size: 0x400
float __ubuf__ *UB_S26624_E34816 = (float __ubuf__ *)get_imm(0x6800); // size: 0x2000
float __ubuf__ *UB_S34816_E35840 = (float __ubuf__ *)get_imm(0x8800); // size: 0x400
float __ubuf__ *UB_S1024_E9216 = (float __ubuf__ *)get_imm(0x400); // size: 0x2000
float __ubuf__ *UB_S18432_E26624 = (float __ubuf__ *)get_imm(0x4800); // size: 0x2000
float __ubuf__ *UB_S35840_E44032 = (float __ubuf__ *)get_imm(0x8c00); // size: 0x2000
SUBKERNEL_PHASE1
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__ubuf__ float*)UB_S0_E1024, (__gm__ float*)GET_PARAM_ADDR(param, 1, 10), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 1, 10), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 10, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 10, 1)));
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID0);
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__ubuf__ float*)UB_S9216_E17408, (__gm__ float*)GET_PARAM_ADDR(param, 4, 37), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 4, 37), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 37, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 37, 1)));
SUBKERNEL_PHASE2
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID1);
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__ubuf__ float*)UB_S17408_E18432, (__gm__ float*)GET_PARAM_ADDR(param, 0, 1), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 0, 1), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 1, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 1, 1)));
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID2);
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__ubuf__ float*)UB_S26624_E34816, (__gm__ float*)GET_PARAM_ADDR(param, 2, 19), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 2, 19), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 19, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 19, 1)));
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID3);
TileOp::DynUBCopyIn<float, 1, 1, 1, 32, 1, 1, 1, 32, 8>((__ubuf__ float*)UB_S34816_E35840, (__gm__ float*)GET_PARAM_ADDR(param, 3, 28), 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 3, 28), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 28, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 28, 1)));
set_flag(PIPE_MTE2, PIPE_V, EVENT_ID4);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID0);
TileOp::Texpand_<float, 1, 1, 32, 64, 1, 1, 32, 1, /*DS*/ 1, 32, 64, /*SS*/ 1, 32, 8, 3>((__ubuf__ float*)UB_S1024_E9216, (__ubuf__ float*)UB_S0_E1024);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID1);
pipe_barrier(PIPE_V);
TileOp::Tmul_<float, /*OS0*/ 1, 1, 32, 64, /*OS1*/ 1, 1, 32, 64, /*DS*/ 1, 1, 32, 64, /*S0*/ 1, 1, 32, 64, /*S1*/ 1, 1, 32, 64>((__ubuf__ float*)UB_S9216_E17408, (__ubuf__ float*)UB_S9216_E17408, (__ubuf__ float*)UB_S1024_E9216);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID2);
TileOp::Texpand_<float, 1, 1, 32, 64, 1, 1, 32, 1, /*DS*/ 1, 32, 64, /*SS*/ 1, 32, 8, 3>((__ubuf__ float*)UB_S18432_E26624, (__ubuf__ float*)UB_S17408_E18432);
pipe_barrier(PIPE_V);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID3);
TileOp::Tmul_<float, /*OS0*/ 1, 1, 32, 64, /*OS1*/ 1, 1, 32, 64, /*DS*/ 1, 1, 32, 64, /*S0*/ 1, 1, 32, 64, /*S1*/ 1, 1, 32, 64>((__ubuf__ float*)UB_S26624_E34816, (__ubuf__ float*)UB_S26624_E34816, (__ubuf__ float*)UB_S18432_E26624);
pipe_barrier(PIPE_V);
TileOp::Tadd_<float, /*OS0*/ 1, 1, 32, 64, /*OS1*/ 1, 1, 32, 64, /*DS*/ 1, 1, 32, 64, /*S0*/ 1, 1, 32, 64, /*S1*/ 1, 1, 32, 64>((__ubuf__ float*)UB_S9216_E17408, (__ubuf__ float*)UB_S9216_E17408, (__ubuf__ float*)UB_S26624_E34816);
wait_flag(PIPE_MTE2, PIPE_V, EVENT_ID4);
TileOp::Texpand_<float, 1, 1, 32, 64, 1, 1, 32, 1, /*DS*/ 1, 32, 64, /*SS*/ 1, 32, 8, 3>((__ubuf__ float*)UB_S35840_E44032, (__ubuf__ float*)UB_S34816_E35840);
pipe_barrier(PIPE_V);
TileOp::Tdiv_<float, /*OS0*/ 1, 1, 32, 64, /*OS1*/ 1, 1, 32, 64, /*DS*/ 1, 1, 32, 64, /*S0*/ 1, 1, 32, 64, /*S1*/ 1, 1, 32, 64>((__ubuf__ float*)UB_S9216_E17408, (__ubuf__ float*)UB_S9216_E17408, (__ubuf__ float*)UB_S35840_E44032);
set_flag(PIPE_V, PIPE_MTE3, EVENT_ID0);
wait_flag(PIPE_V, PIPE_MTE3, EVENT_ID0);
TileOp::DynUBCopyOut<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__gm__ float*)GET_PARAM_ADDR(param, 6, 55), (__ubuf__ float*)UB_S9216_E17408, 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 6, 55), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 55, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 55, 1)));
TileOp::DynUBCopyOut<float, 1, 1, 1, 32, 64, 1, 1, 32, 64>((__gm__ float*)GET_PARAM_ADDR(param, 5, 46), (__ubuf__ float*)UB_S9216_E17408, 1, 1, 1, GET_PARAM_RAWSHAPE_2(param, 5, 46), 0, 0, 0, (RUNTIME_COA_GET_PARAM_OFFSET(2, 46, 0)), (RUNTIME_COA_GET_PARAM_OFFSET(2, 46, 1)));
}
