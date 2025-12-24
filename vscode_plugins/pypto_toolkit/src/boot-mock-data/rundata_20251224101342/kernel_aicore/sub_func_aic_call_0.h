extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_0_4503599627370496(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH2_10_1_58546795155816448(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_4_22517998136852480(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
__attribute__((always_inline)) inline __aicore__ void CallSubFuncTask(uint64_t funcIdx, CoreFuncParam *param, int64_t gmStackAddr, __gm__ int64_t *hcclContext) {
    switch (funcIdx) {
        case 6: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_0_4503599627370496(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 8: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH2_10_1_58546795155816448(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 10: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_4_22517998136852480(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        default:
            return;
    };
    return;
}
