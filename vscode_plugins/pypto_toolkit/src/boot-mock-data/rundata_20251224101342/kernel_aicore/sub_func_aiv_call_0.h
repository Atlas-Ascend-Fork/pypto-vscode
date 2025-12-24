extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_1_9007199254740992(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH1_9_3_49539595901075456(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH1_9_0_36028797018963968(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH1_9_2_45035996273704960(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH2_10_0_54043195528445952(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH2_10_2_63050394783186944(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_5_27021597764222976(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_2_13510798882111488(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_6_31525197391593472(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH3_11_1_72057594037927936(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH3_11_0_67553994410557440(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH1_9_1_40532396646334464(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
extern "C" [aicore] void TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_3_18014398509481984(CoreFuncParam* param, int64_t GMStackBase, __gm__ int64_t *hcclContext, __gm__ GMTensorInfo* oriAddrParam);
__attribute__((always_inline)) inline __aicore__ void CallSubFuncTask(uint64_t funcIdx, CoreFuncParam *param, int64_t gmStackAddr, __gm__ int64_t *hcclContext) {
    switch (funcIdx) {
        case 1: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_1_9007199254740992(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 2: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH1_9_3_49539595901075456(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 3: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH1_9_0_36028797018963968(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 4: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH1_9_2_45035996273704960(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 5: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH2_10_0_54043195528445952(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 7: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH2_10_2_63050394783186944(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 9: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_5_27021597764222976(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 11: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_2_13510798882111488(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 12: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_6_31525197391593472(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 13: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH3_11_1_72057594037927936(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 14: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH3_11_0_67553994410557440(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 15: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH1_9_1_40532396646334464(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        case 16: {
            TENSOR_LOOP_L2_bn_Unroll1_PATH0_8_3_18014398509481984(param, gmStackAddr, hcclContext, nullptr);
            break;
        }
        default:
            return;
    };
    return;
}
