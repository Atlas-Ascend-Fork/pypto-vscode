#include "TileOpImpl.h"

// funcHash: 8291378819801422573

extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH2_10_1_58546795155816448(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam) {
bfloat16_t __cbuf__ *L1_S0_E4096 = (bfloat16_t __cbuf__ *)get_imm(0x0); // size: 0x1000
bfloat16_t __cbuf__ *L1_S4096_E20480 = (bfloat16_t __cbuf__ *)get_imm(0x1000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S20480_E24576 = (bfloat16_t __cbuf__ *)get_imm(0x5000); // size: 0x1000
bfloat16_t __cbuf__ *L1_S24576_E40960 = (bfloat16_t __cbuf__ *)get_imm(0x6000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S40960_E57344 = (bfloat16_t __cbuf__ *)get_imm(0xa000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S57344_E73728 = (bfloat16_t __cbuf__ *)get_imm(0xe000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S73728_E90112 = (bfloat16_t __cbuf__ *)get_imm(0x12000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S90112_E106496 = (bfloat16_t __cbuf__ *)get_imm(0x16000); // size: 0x4000
bfloat16_t __ca__ *L0A_S0_E4096 = (bfloat16_t __ca__ *)get_imm(0x0); // size: 0x1000
bfloat16_t __ca__ *L0A_S8192_E12288 = (bfloat16_t __ca__ *)get_imm(0x2000); // size: 0x1000
bfloat16_t __ca__ *L0A_S16384_E20480 = (bfloat16_t __ca__ *)get_imm(0x4000); // size: 0x1000
bfloat16_t __cb__ *L0B_S0_E16384 = (bfloat16_t __cb__ *)get_imm(0x0); // size: 0x4000
bfloat16_t __ca__ *L0A_S4096_E8192 = (bfloat16_t __ca__ *)get_imm(0x1000); // size: 0x1000
bfloat16_t __cb__ *L0B_S16384_E32768 = (bfloat16_t __cb__ *)get_imm(0x4000); // size: 0x4000
bfloat16_t __cb__ *L0B_S32768_E49152 = (bfloat16_t __cb__ *)get_imm(0x8000); // size: 0x4000
bfloat16_t __ca__ *L0A_S12288_E16384 = (bfloat16_t __ca__ *)get_imm(0x3000); // size: 0x1000
float __cc__ *L0C_S0_E16384 = (float __cc__ *)get_imm(0x0); // size: 0x4000
float __cc__ *L0C_S16384_E32768 = (float __cc__ *)get_imm(0x4000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S106496_E122880 = (bfloat16_t __cbuf__ *)get_imm(0x1a000); // size: 0x4000
bfloat16_t __cbuf__ *L1_S122880_E139264 = (bfloat16_t __cbuf__ *)get_imm(0x1e000); // size: 0x4000
bfloat16_t __cb__ *L0B_S49152_E65536 = (bfloat16_t __cb__ *)get_imm(0xc000); // size: 0x4000
bfloat16_t __ca__ *L0A_S20480_E24576 = (bfloat16_t __ca__ *)get_imm(0x5000); // size: 0x1000
bfloat16_t __ca__ *L0A_S24576_E28672 = (bfloat16_t __ca__ *)get_imm(0x6000); // size: 0x1000
bfloat16_t __ca__ *L0A_S28672_E32768 = (bfloat16_t __ca__ *)get_imm(0x7000); // size: 0x1000
float __cc__ *L0C_S32768_E49152 = (float __cc__ *)get_imm(0x8000); // size: 0x4000
float __cc__ *L0C_S49152_E65536 = (float __cc__ *)get_imm(0xc000); // size: 0x4000
SUBKERNEL_PHASE1
TileOp::DynL1CopyIn<bfloat16_t, bfloat16_t, 32, 64>((__cbuf__ bfloat16_t*)L1_S0_E4096, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 0, 1), GET_PARAM_RAWSHAPE_2(param, 0, 1), GET_PARAM_OFFSET_2(param, 0, 1), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID0);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 64, 128>((__cbuf__ bfloat16_t*)L1_S4096_E20480, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 5, 46), GET_PARAM_RAWSHAPE_2(param, 5, 46), GET_PARAM_OFFSET_2(param, 5, 46), 128, 512, 0);
SUBKERNEL_PHASE2
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID1);
TileOp::DynL1CopyIn<bfloat16_t, bfloat16_t, 32, 64>((__cbuf__ bfloat16_t*)L1_S20480_E24576, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 1, 10), GET_PARAM_RAWSHAPE_2(param, 1, 10), GET_PARAM_OFFSET_2(param, 1, 10), 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID2);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 64, 128>((__cbuf__ bfloat16_t*)L1_S24576_E40960, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 9, 82), GET_PARAM_RAWSHAPE_2(param, 9, 82), GET_PARAM_OFFSET_2(param, 9, 82), 128, 512, 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID3);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 64, 128>((__cbuf__ bfloat16_t*)L1_S40960_E57344, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 4, 37), GET_PARAM_RAWSHAPE_2(param, 4, 37), GET_PARAM_OFFSET_2(param, 4, 37), 128, 512, 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID4);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 64, 128>((__cbuf__ bfloat16_t*)L1_S57344_E73728, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 8, 73), GET_PARAM_RAWSHAPE_2(param, 8, 73), GET_PARAM_OFFSET_2(param, 8, 73), 128, 512, 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID5);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 64, 128>((__cbuf__ bfloat16_t*)L1_S73728_E90112, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 3, 28), GET_PARAM_RAWSHAPE_2(param, 3, 28), GET_PARAM_OFFSET_2(param, 3, 28), 128, 512, 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID6);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 64, 128>((__cbuf__ bfloat16_t*)L1_S90112_E106496, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 7, 64), GET_PARAM_RAWSHAPE_2(param, 7, 64), GET_PARAM_OFFSET_2(param, 7, 64), 128, 512, 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID7);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID0);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S0_E4096, (__cbuf__ bfloat16_t*)L1_S0_E4096);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S8192_E12288, (__cbuf__ bfloat16_t*)L1_S0_E4096);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S16384_E20480, (__cbuf__ bfloat16_t*)L1_S0_E4096);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID1);
TileOp::L1ToL0B<bfloat16_t, 64, 128, 0, 0, 64, 128>((__cb__ bfloat16_t*)L0B_S0_E16384, (__cbuf__ bfloat16_t*)L1_S4096_E20480);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID0);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID2);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S4096_E8192, (__cbuf__ bfloat16_t*)L1_S20480_E24576);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID3);
TileOp::L1ToL0B<bfloat16_t, 64, 128, 0, 0, 64, 128>((__cb__ bfloat16_t*)L0B_S16384_E32768, (__cbuf__ bfloat16_t*)L1_S24576_E40960);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID1);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID4);
TileOp::L1ToL0B<bfloat16_t, 64, 128, 0, 0, 64, 128>((__cb__ bfloat16_t*)L0B_S32768_E49152, (__cbuf__ bfloat16_t*)L1_S40960_E57344);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID2);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S12288_E16384, (__cbuf__ bfloat16_t*)L1_S20480_E24576);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID0);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S0_E16384, (__ca__ bfloat16_t*)L0A_S0_E4096, (__cb__ bfloat16_t*)L0B_S0_E16384, 32, 64, 128, true, 0);
set_flag(PIPE_M, PIPE_MTE1, EVENT_ID0);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID1);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S0_E16384, (__ca__ bfloat16_t*)L0A_S4096_E8192, (__cb__ bfloat16_t*)L0B_S16384_E32768, 32, 64, 128, false, 0);
set_flag(PIPE_M, PIPE_FIX, EVENT_ID0);
set_flag(PIPE_M, PIPE_MTE1, EVENT_ID1);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID2);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S16384_E32768, (__ca__ bfloat16_t*)L0A_S8192_E12288, (__cb__ bfloat16_t*)L0B_S32768_E49152, 32, 64, 128, true, 0);
set_flag(PIPE_M, PIPE_MTE1, EVENT_ID2);
wait_flag(PIPE_M, PIPE_FIX, EVENT_ID0);
TileOp::DynL0CCopyOut<float, float, 32, 128, 32, 128>((__gm__ float*)GET_PARAM_ADDR(param, 13, 118), (__cc__ float*)L0C_S0_E16384, GET_PARAM_RAWSHAPE_2(param, 13, 118), GET_PARAM_OFFSET_2(param, 13, 118), 0);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 64, 128>((__cbuf__ bfloat16_t*)L1_S106496_E122880, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 2, 19), GET_PARAM_RAWSHAPE_2(param, 2, 19), GET_PARAM_OFFSET_2(param, 2, 19), 128, 512, 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID0);
TileOp::DynL1CopyInNZ2NZ<bfloat16_t, bfloat16_t, 64, 128>((__cbuf__ bfloat16_t*)L1_S122880_E139264, (__gm__ bfloat16_t*)GET_PARAM_ADDR(param, 6, 55), GET_PARAM_RAWSHAPE_2(param, 6, 55), GET_PARAM_OFFSET_2(param, 6, 55), 128, 512, 0);
set_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID1);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID5);
TileOp::L1ToL0B<bfloat16_t, 64, 128, 0, 0, 64, 128>((__cb__ bfloat16_t*)L0B_S49152_E65536, (__cbuf__ bfloat16_t*)L1_S57344_E73728);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID3);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID6);
wait_flag(PIPE_M, PIPE_MTE1, EVENT_ID0);
TileOp::L1ToL0B<bfloat16_t, 64, 128, 0, 0, 64, 128>((__cb__ bfloat16_t*)L0B_S0_E16384, (__cbuf__ bfloat16_t*)L1_S73728_E90112);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID4);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S20480_E24576, (__cbuf__ bfloat16_t*)L1_S20480_E24576);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID7);
wait_flag(PIPE_M, PIPE_MTE1, EVENT_ID1);
TileOp::L1ToL0B<bfloat16_t, 64, 128, 0, 0, 64, 128>((__cb__ bfloat16_t*)L0B_S16384_E32768, (__cbuf__ bfloat16_t*)L1_S90112_E106496);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID5);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S24576_E28672, (__cbuf__ bfloat16_t*)L1_S0_E4096);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID0);
wait_flag(PIPE_M, PIPE_MTE1, EVENT_ID2);
TileOp::L1ToL0B<bfloat16_t, 64, 128, 0, 0, 64, 128>((__cb__ bfloat16_t*)L0B_S32768_E49152, (__cbuf__ bfloat16_t*)L1_S106496_E122880);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID6);
TileOp::L1ToL0A<bfloat16_t, 32, 64, 0, 0, 32, 64>((__ca__ bfloat16_t*)L0A_S28672_E32768, (__cbuf__ bfloat16_t*)L1_S20480_E24576);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID3);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S16384_E32768, (__ca__ bfloat16_t*)L0A_S12288_E16384, (__cb__ bfloat16_t*)L0B_S49152_E65536, 32, 64, 128, false, 0);
set_flag(PIPE_M, PIPE_FIX, EVENT_ID1);
set_flag(PIPE_M, PIPE_MTE1, EVENT_ID3);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID4);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S32768_E49152, (__ca__ bfloat16_t*)L0A_S16384_E20480, (__cb__ bfloat16_t*)L0B_S0_E16384, 32, 64, 128, true, 0);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID5);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S32768_E49152, (__ca__ bfloat16_t*)L0A_S20480_E24576, (__cb__ bfloat16_t*)L0B_S16384_E32768, 32, 64, 128, false, 0);
set_flag(PIPE_M, PIPE_FIX, EVENT_ID2);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID6);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S49152_E65536, (__ca__ bfloat16_t*)L0A_S24576_E28672, (__cb__ bfloat16_t*)L0B_S32768_E49152, 32, 64, 128, true, 0);
wait_flag(PIPE_M, PIPE_FIX, EVENT_ID1);
TileOp::DynL0CCopyOut<float, float, 32, 128, 32, 128>((__gm__ float*)GET_PARAM_ADDR(param, 12, 109), (__cc__ float*)L0C_S16384_E32768, GET_PARAM_RAWSHAPE_2(param, 12, 109), GET_PARAM_OFFSET_2(param, 12, 109), 0);
wait_flag(PIPE_M, PIPE_FIX, EVENT_ID2);
TileOp::DynL0CCopyOut<float, float, 32, 128, 32, 128>((__gm__ float*)GET_PARAM_ADDR(param, 11, 100), (__cc__ float*)L0C_S32768_E49152, GET_PARAM_RAWSHAPE_2(param, 11, 100), GET_PARAM_OFFSET_2(param, 11, 100), 0);
wait_flag(PIPE_MTE2, PIPE_MTE1, EVENT_ID1);
wait_flag(PIPE_M, PIPE_MTE1, EVENT_ID3);
TileOp::L1ToL0B<bfloat16_t, 64, 128, 0, 0, 64, 128>((__cb__ bfloat16_t*)L0B_S49152_E65536, (__cbuf__ bfloat16_t*)L1_S122880_E139264);
set_flag(PIPE_MTE1, PIPE_M, EVENT_ID7);
wait_flag(PIPE_MTE1, PIPE_M, EVENT_ID7);
pipe_barrier(PIPE_M);
TileOp::Tmad<float, bfloat16_t, bfloat16_t, 0, 0, 32, 128>((__cc__ float*)L0C_S49152_E65536, (__ca__ bfloat16_t*)L0A_S28672_E32768, (__cb__ bfloat16_t*)L0B_S49152_E65536, 32, 64, 128, false, 0);
set_flag(PIPE_M, PIPE_FIX, EVENT_ID3);
wait_flag(PIPE_M, PIPE_FIX, EVENT_ID3);
TileOp::DynL0CCopyOut<float, float, 32, 128, 32, 128>((__gm__ float*)GET_PARAM_ADDR(param, 10, 91), (__cc__ float*)L0C_S49152_E65536, GET_PARAM_RAWSHAPE_2(param, 10, 91), GET_PARAM_OFFSET_2(param, 10, 91), 0);
}
