#include "TileOpImpl.h"

// funcHash: 7291259776373332083

extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_0_4503599627370496(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam) {
bfloat16_t __cbuf__ *L1_S0_E4096 = (bfloat16_t __cbuf__ *)get_imm(0x0); // size: 0x1000
bfloat16_t __cbuf__ *L1_S4096_E20480 = (bfloat16_t __cbuf__ *)get_imm(0x1000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S20480_E24576 = (bfloat16_t __cbuf__ *)get_imm(0x5000); // size: 0x1000
bfloat16_t __cbuf__ *L1_S24576_E40960 = (bfloat16_t __cbuf__ *)get_imm(0x6000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S40960_E45056 = (bfloat16_t __cbuf__ *)get_imm(0xa000); // size: 0x1000
bfloat16_t __cbuf__ *L1_S45056_E61440 = (bfloat16_t __cbuf__ *)get_imm(0xb000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S61440_E65536 = (bfloat16_t __cbuf__ *)get_imm(0xf000); // size: 0x1000
bfloat16_t __cbuf__ *L1_S65536_E81920 = (bfloat16_t __cbuf__ *)get_imm(0x10000); // size: 0x4000
bfloat16_t __ca__ *L0A_S0_E4096 = (bfloat16_t __ca__ *)get_imm(0x0); // size: 0x1000
bfloat16_t __cb__ *L0B_S0_E16384 = (bfloat16_t __cb__ *)get_imm(0x0); // size: 0x4000
bfloat16_t __ca__ *L0A_S4096_E8192 = (bfloat16_t __ca__ *)get_imm(0x1000); // size: 0x1000
bfloat16_t __cb__ *L0B_S16384_E32768 = (bfloat16_t __cb__ *)get_imm(0x4000); // size: 0x4000
bfloat16_t __ca__ *L0A_S8192_E12288 = (bfloat16_t __ca__ *)get_imm(0x2000); // size: 0x1000
bfloat16_t __cb__ *L0B_S32768_E49152 = (bfloat16_t __cb__ *)get_imm(0x8000); // size: 0x4000
bfloat16_t __ca__ *L0A_S12288_E16384 = (bfloat16_t __ca__ *)get_imm(0x3000); // size: 0x1000
bfloat16_t __cb__ *L0B_S49152_E65536 = (bfloat16_t __cb__ *)get_imm(0xc000); // size: 0x4000
float __cc__ *L0C_S0_E16384 = (float __cc__ *)get_imm(0x0); // size: 0x4000
bfloat16_t __cbuf__ *L1_S81920_E86016 = (bfloat16_t __cbuf__ *)get_imm(0x14000); // size: 0x1000
bfloat16_t __cbuf__ *L1_S86016_E102400 = (bfloat16_t __cbuf__ *)get_imm(0x15000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S102400_E106496 = (bfloat16_t __cbuf__ *)get_imm(0x19000); // size: 0x1000
bfloat16_t __cbuf__ *L1_S106496_E122880 = (bfloat16_t __cbuf__ *)get_imm(0x1a000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S122880_E126976 = (bfloat16_t __cbuf__ *)get_imm(0x1e000); // size: 0x1000
bfloat16_t __cbuf__ *L1_S126976_E143360 = (bfloat16_t __cbuf__ *)get_imm(0x1f000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S143360_E147456 = (bfloat16_t __cbuf__ *)get_imm(0x23000); // size: 0x1000
bfloat16_t __cbuf__ *L1_S147456_E163840 = (bfloat16_t __cbuf__ *)get_imm(0x24000); // size: 0x4000
bfloat16_t __ca__ *L0A_S16384_E20480 = (bfloat16_t __ca__ *)get_imm(0x4000); // size: 0x1000
bfloat16_t __ca__ *L0A_S20480_E24576 = (bfloat16_t __ca__ *)get_imm(0x5000); // size: 0x1000
bfloat16_t __ca__ *L0A_S24576_E28672 = (bfloat16_t __ca__ *)get_imm(0x6000); // size: 0x1000
bfloat16_t __ca__ *L0A_S28672_E32768 = (bfloat16_t __ca__ *)get_imm(0x7000); // size: 0x1000
bfloat16_t __cbuf__ *L1_S163840_E167936 = (bfloat16_t __cbuf__ *)get_imm(0x28000); // size: 0x1000
bfloat16_t __cbuf__ *L1_S167936_E184320 = (bfloat16_t __cbuf__ *)get_imm(0x29000); // size: 0x4000
bfloat16_t __ca__ *L0A_S32768_E36864 = (bfloat16_t __ca__ *)get_imm(0x8000); // size: 0x1000
SUBKERNEL_PHASE1
TileOp::DynL1CopyIn<bfloat16_t, bfloat16_t, 32, 64>((__cbuf__ bfloat16_t*)L1_S0_E4096, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 1, 10), GET_PARAM_RAWSHAPE_2(param, 1, 10), GET_PARAM_OFFSET_2(param, 1, 10), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID0);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 128, 64>((__cbuf__ bfloat16_t*)L1_S4096_E20480, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 0, 1), GET_PARAM_RAWSHAPE_2(param, 0, 1), GET_PARAM_OFFSET_2(param, 0, 1), 128, GET_PARAM_RAWSHAPE_BY_IDX(param, 0, 1, 2, 1), 0);
SUBKERNEL_PHASE2
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID1);
TileOp::DynL1CopyIn<bfloat16_t, bfloat16_t, 32, 64>((__cbuf__ bfloat16_t*)L1_S20480_E24576, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 3, 28), GET_PARAM_RAWSHAPE_2(param, 3, 28), GET_PARAM_OFFSET_2(param, 3, 28), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID2);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 128, 64>((__cbuf__ bfloat16_t*)L1_S24576_E40960, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 2, 19), GET_PARAM_RAWSHAPE_2(param, 2, 19), GET_PARAM_OFFSET_2(param, 2, 19), 128, GET_PARAM_RAWSHAPE_BY_IDX(param, 2, 19, 2, 1), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID3);
TileOp::DynL1CopyIn<bfloat16_t, bfloat16_t, 32, 64>((__cbuf__ bfloat16_t*)L1_S40960_E45056, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 5, 46), GET_PARAM_RAWSHAPE_2(param, 5, 46), GET_PARAM_OFFSET_2(param, 5, 46), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID4);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 128, 64>((__cbuf__ bfloat16_t*)L1_S45056_E61440, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 4, 37), GET_PARAM_RAWSHAPE_2(param, 4, 37), GET_PARAM_OFFSET_2(param, 4, 37), 128, GET_PARAM_RAWSHAPE_BY_IDX(param, 4, 37, 2, 1), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID5);
TileOp::DynL1CopyIn<bfloat16_t, bfloat16_t, 32, 64>((__cbuf__ bfloat16_t*)L1_S61440_E65536, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 7, 64), GET_PARAM_RAWSHAPE_2(param, 7, 64), GET_PARAM_OFFSET_2(param, 7, 64), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID6);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 128, 64>((__cbuf__ bfloat16_t*)L1_S65536_E81920, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 6, 55), GET_PARAM_RAWSHAPE_2(param, 6, 55), GET_PARAM_OFFSET_2(param, 6, 55), 128, GET_PARAM_RAWSHAPE_BY_IDX(param, 6, 55, 2, 1), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID7);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID0);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S0_E4096, (__cbuf__ bfloat16_t*)L1_S0_E4096);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID1);
TileOp::L1ToL0Bt<bfloat16_t, 64, 128, 0, 0, 128, 64>((__cb__ bfloat16_t*)L0B_S0_E16384, (__cbuf__ bfloat16_t*)L1_S4096_E20480);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID0);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID2);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S4096_E8192, (__cbuf__ bfloat16_t*)L1_S20480_E24576);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID3);
TileOp::L1ToL0Bt<bfloat16_t, 64, 128, 0, 0, 128, 64>((__cb__ bfloat16_t*)L0B_S16384_E32768, (__cbuf__ bfloat16_t*)L1_S24576_E40960);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID1);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID4);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S8192_E12288, (__cbuf__ bfloat16_t*)L1_S40960_E45056);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID5);
TileOp::L1ToL0Bt<bfloat16_t, 64, 128, 0, 0, 128, 64>((__cb__ bfloat16_t*)L0B_S32768_E49152, (__cbuf__ bfloat16_t*)L1_S45056_E61440);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID2);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID6);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S12288_E16384, (__cbuf__ bfloat16_t*)L1_S61440_E65536);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID7);
TileOp::L1ToL0Bt<bfloat16_t, 64, 128, 0, 0, 128, 64>((__cb__ bfloat16_t*)L0B_S49152_E65536, (__cbuf__ bfloat16_t*)L1_S65536_E81920);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID3);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID0);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S0_E16384, (__ca__ bfloat16_t*)L0A_S0_E4096, (__cb__ bfloat16_t*)L0B_S0_E16384, 32, 64, 128, true, 0);
set_flag(PIPE_M, PIPE_MTE1, EVENT_ID0);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID1);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S0_E16384, (__ca__ bfloat16_t*)L0A_S4096_E8192, (__cb__ bfloat16_t*)L0B_S16384_E32768, 32, 64, 128, false, 0);
set_flag(PIPE_M, PIPE_MTE1, EVENT_ID1);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID2);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S0_E16384, (__ca__ bfloat16_t*)L0A_S8192_E12288, (__cb__ bfloat16_t*)L0B_S32768_E49152, 32, 64, 128, false, 0);
set_flag(PIPE_M, PIPE_MTE1, EVENT_ID2);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID3);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S0_E16384, (__ca__ bfloat16_t*)L0A_S12288_E16384, (__cb__ bfloat16_t*)L0B_S49152_E65536, 32, 64, 128, false, 0);
set_flag(PIPE_M, PIPE_MTE1, EVENT_ID3);
TileOp::DynL1CopyIn<bfloat16_t, bfloat16_t, 32, 64>((__cbuf__ bfloat16_t*)L1_S81920_E86016, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 9, 82), GET_PARAM_RAWSHAPE_2(param, 9, 82), GET_PARAM_OFFSET_2(param, 9, 82), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID0);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 128, 64>((__cbuf__ bfloat16_t*)L1_S86016_E102400, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 8, 73), GET_PARAM_RAWSHAPE_2(param, 8, 73), GET_PARAM_OFFSET_2(param, 8, 73), 128, GET_PARAM_RAWSHAPE_BY_IDX(param, 8, 73, 2, 1), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID1);
TileOp::DynL1CopyIn<bfloat16_t, bfloat16_t, 32, 64>((__cbuf__ bfloat16_t*)L1_S102400_E106496, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 11, 100), GET_PARAM_RAWSHAPE_2(param, 11, 100), GET_PARAM_OFFSET_2(param, 11, 100), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID2);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 128, 64>((__cbuf__ bfloat16_t*)L1_S106496_E122880, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 10, 91), GET_PARAM_RAWSHAPE_2(param, 10, 91), GET_PARAM_OFFSET_2(param, 10, 91), 128, GET_PARAM_RAWSHAPE_BY_IDX(param, 10, 91, 2, 1), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID3);
TileOp::DynL1CopyIn<bfloat16_t, bfloat16_t, 32, 64>((__cbuf__ bfloat16_t*)L1_S122880_E126976, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 13, 118), GET_PARAM_RAWSHAPE_2(param, 13, 118), GET_PARAM_OFFSET_2(param, 13, 118), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID4);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 128, 64>((__cbuf__ bfloat16_t*)L1_S126976_E143360, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 12, 109), GET_PARAM_RAWSHAPE_2(param, 12, 109), GET_PARAM_OFFSET_2(param, 12, 109), 128, GET_PARAM_RAWSHAPE_BY_IDX(param, 12, 109, 2, 1), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID5);
TileOp::DynL1CopyIn<bfloat16_t, bfloat16_t, 32, 64>((__cbuf__ bfloat16_t*)L1_S143360_E147456, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 15, 136), GET_PARAM_RAWSHAPE_2(param, 15, 136), GET_PARAM_OFFSET_2(param, 15, 136), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID6);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 128, 64>((__cbuf__ bfloat16_t*)L1_S147456_E163840, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 14, 127), GET_PARAM_RAWSHAPE_2(param, 14, 127), GET_PARAM_OFFSET_2(param, 14, 127), 128, GET_PARAM_RAWSHAPE_BY_IDX(param, 14, 127, 2, 1), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID7);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID0);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S16384_E20480, (__cbuf__ bfloat16_t*)L1_S81920_E86016);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID1);
wait_flag(PIPE_M, PIPE_MTE1, EVENT_ID0);
TileOp::L1ToL0Bt<bfloat16_t, 64, 128, 0, 0, 128, 64>((__cb__ bfloat16_t*)L0B_S0_E16384, (__cbuf__ bfloat16_t*)L1_S86016_E102400);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID4);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID2);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S20480_E24576, (__cbuf__ bfloat16_t*)L1_S102400_E106496);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID3);
wait_flag(PIPE_M, PIPE_MTE1, EVENT_ID1);
TileOp::L1ToL0Bt<bfloat16_t, 64, 128, 0, 0, 128, 64>((__cb__ bfloat16_t*)L0B_S16384_E32768, (__cbuf__ bfloat16_t*)L1_S106496_E122880);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID5);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID4);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S24576_E28672, (__cbuf__ bfloat16_t*)L1_S122880_E126976);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID5);
wait_flag(PIPE_M, PIPE_MTE1, EVENT_ID2);
TileOp::L1ToL0Bt<bfloat16_t, 64, 128, 0, 0, 128, 64>((__cb__ bfloat16_t*)L0B_S32768_E49152, (__cbuf__ bfloat16_t*)L1_S126976_E143360);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID6);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID6);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S28672_E32768, (__cbuf__ bfloat16_t*)L1_S143360_E147456);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID7);
wait_flag(PIPE_M, PIPE_MTE1, EVENT_ID3);
TileOp::L1ToL0Bt<bfloat16_t, 64, 128, 0, 0, 128, 64>((__cb__ bfloat16_t*)L0B_S49152_E65536, (__cbuf__ bfloat16_t*)L1_S147456_E163840);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID7);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID4);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S0_E16384, (__ca__ bfloat16_t*)L0A_S16384_E20480, (__cb__ bfloat16_t*)L0B_S0_E16384, 32, 64, 128, false, 0);
set_flag(PIPE_M, PIPE_MTE1, EVENT_ID4);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID5);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S0_E16384, (__ca__ bfloat16_t*)L0A_S20480_E24576, (__cb__ bfloat16_t*)L0B_S16384_E32768, 32, 64, 128, false, 0);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID6);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S0_E16384, (__ca__ bfloat16_t*)L0A_S24576_E28672, (__cb__ bfloat16_t*)L0B_S32768_E49152, 32, 64, 128, false, 0);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID7);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S0_E16384, (__ca__ bfloat16_t*)L0A_S28672_E32768, (__cb__ bfloat16_t*)L0B_S49152_E65536, 32, 64, 128, false, 0);
TileOp::DynL1CopyIn<bfloat16_t, bfloat16_t, 32, 64>((__cbuf__ bfloat16_t*)L1_S163840_E167936, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 17, 154), GET_PARAM_RAWSHAPE_2(param, 17, 154), GET_PARAM_OFFSET_2(param, 17, 154), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID0);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 128, 64>((__cbuf__ bfloat16_t*)L1_S167936_E184320, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 16, 145), GET_PARAM_RAWSHAPE_2(param, 16, 145), GET_PARAM_OFFSET_2(param, 16, 145), 128, GET_PARAM_RAWSHAPE_BY_IDX(param, 16, 145, 2, 1), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID1);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID0);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S32768_E36864, (__cbuf__ bfloat16_t*)L1_S163840_E167936);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID1);
wait_flag(PIPE_M, PIPE_MTE1, EVENT_ID4);
TileOp::L1ToL0Bt<bfloat16_t, 64, 128, 0, 0, 128, 64>((__cb__ bfloat16_t*)L0B_S0_E16384, (__cbuf__ bfloat16_t*)L1_S167936_E184320);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID0);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID0);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S0_E16384, (__ca__ bfloat16_t*)L0A_S32768_E36864, (__cb__ bfloat16_t*)L0B_S0_E16384, 32, 64, 128, false, 0);
set_flag(PIPE_M, PIPE_FIX, EVENT_ID0);
wait_flag(PIPE_M, PIPE_FIX, EVENT_ID0);
TileOp::DynL0CCopyOut<float, float, 32, 128, 32, 128>((__gm__ float*)GET_PARAM_ADDR(param, 18, 163), (__cc__ float*)L0C_S0_E16384, GET_PARAM_RAWSHAPE_2(param, 18, 163), GET_PARAM_OFFSET_2(param, 18, 163), 0);
}
