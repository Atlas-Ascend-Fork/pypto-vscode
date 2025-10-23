export const HistoryList = [
  {
    title: 'simulation_20250723_02',
    executeTime: '2025-07-14 12:00:00',
    directoryPath: 'd:/aa',
    sourceFilePath: '',
    controlFlowFilePath: 'd:/aa/program.json',
    swimlaneGraphFilePath: '',
  },
  {
    title: 'simulation_20250723',
    executeTime: '2025-07-14 12:00:00',
    directoryPath: 'd:/aa',
    sourceFilePath: '',
    controlFlowFilePath: 'd:/aa/program1.json',
    swimlaneGraphFilePath: '',
  },
  {
    title: 'onChip_20250723',
    executeTime: '2025-07-14 12:00:00',
    directoryPath: 'd:/aa',
    sourceFilePath: '',
    controlFlowFilePath: 'd:/aa/program2.json',
    swimlaneGraphFilePath: '',
  },
];

export const PathList = [
  {
    nodeType: 'LOOP',
    magic: 3,
    magicName: 'TENSOR_MLA_LOOP_L0_bIdx_Unroll1_3',
    hash: '6066228143414080993',
    children: [
      {
        nodeType: 'LOOP',
        magic: 5,
        magicName: 'TENSOR_MLA_LOOP_L0_sIdx_Unroll1_5',
        hash: '183298',
        children: [
          {
            nodeType: 'PATH',
            magic: 50,
            magicName: 'TENSOR_MLA_LOOP_L0_sIdx_Unroll1_PATH0_root_50',
            hash: '367751',
            meta: {
              leafFunctions: [
                { magic: 51, magicName: 'TENSOR_MLA_LOOP_L1_sIdx_Unroll1_PATH0_leaf0_51', hash: '754738' },
                { magic: 171, magicName: 'TENSOR_MLA_LOOP_L1_sIdx_Unroll1_PATH0_leaf120_171', hash: '620834' },
              ],
              passes: [
                { passIndex: '00', passStage: 'tensor', passName: 'LoopUnroll', hasHealthReport: false },
                { passIndex: '01', passStage: 'tensor', passName: 'InferMemoryConflict', hasHealthReport: false },
                { passIndex: '02', passStage: 'tensor', passName: 'ExpandFunction', hasHealthReport: false },
                { passIndex: '03', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '04', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '05', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '06', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '07', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '08', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '09', passStage: 'block', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '10', passStage: 'block', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '11', passStage: 'block', passName: 'DuplicateView', hasHealthReport: false },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    nodeType: 'LOOP',
    magic: 7,
    magicName: 'TENSOR_LOOP_RESHAPE_INUnroll1_7',
    hash: '476051',
    children: [
      {
        nodeType: 'LOOP',
        magic: 721,
        magicName: 'TENSOR_LOOP_RESHAPE_INUnroll1_PATH0_root_721',
        hash: '459256',
        children: [
          {
            nodeType: 'PATH',
            magic: 501,
            magicName: 'TENSOR_LOOP_RESHAPE_INUnroll1_PATH0_root_501',
            hash: '367751',
            meta: {
              leafFunctions: [
                { magic: 51, magicName: 'TENSOR_MLA_LOOP_L1_sIdx_Unroll1_PATH0_leaf0_51', hash: '754738' },
                { magic: 171, magicName: 'TENSOR_MLA_LOOP_L1_sIdx_Unroll1_PATH0_leaf120_171', hash: '620834' },
              ],
              passes: [
                { passIndex: '00', passStage: 'tensor', passName: 'LoopUnroll', hasHealthReport: false },
                { passIndex: '01', passStage: 'tensor', passName: 'InferMemoryConflict', hasHealthReport: false },
                { passIndex: '02', passStage: 'tensor', passName: 'ExpandFunction', hasHealthReport: false },
                { passIndex: '03', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '04', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '05', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '06', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '07', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '08', passStage: 'tile', passName: 'DuplicateView', hasHealthReport: false },
                { passIndex: '09', passStage: 'block', passName: 'DuplicateView', hasHealthReport: false },
              ],
            },
          },
        ],
      },
    ],
  },
];

export const PassList = [
  { passIndex: '00', passStage: 'tensor', passName: 'LoopUnroll', hasHealthReport: false },
  { passIndex: '01', passStage: 'tensor', passName: 'InferMemoryConflict', hasHealthReport: false },
  { passIndex: '02', passStage: 'tensor', passName: 'ExpandFunction', hasHealthReport: false },
  { passIndex: '03', passStage: 'tile', passName: 'DuplicateView03', hasHealthReport: false },
  { passIndex: '04', passStage: 'tile', passName: 'DuplicateView04', hasHealthReport: false },
  { passIndex: '05', passStage: 'tile', passName: 'DuplicateView05', hasHealthReport: false },
  { passIndex: '06', passStage: 'tile', passName: 'DuplicateView06', hasHealthReport: false },
  { passIndex: '07', passStage: 'tile', passName: 'DuplicateView07', hasHealthReport: false },
  { passIndex: '08', passStage: 'tile', passName: 'DuplicateView08', hasHealthReport: false },
  { passIndex: '09', passStage: 'block', passName: 'DuplicateView09', hasHealthReport: false },
  { passIndex: '10', passStage: 'block', passName: 'DuplicateView10', hasHealthReport: false },
  { passIndex: '11', passStage: 'block', passName: 'DuplicateView11', hasHealthReport: false },
];
