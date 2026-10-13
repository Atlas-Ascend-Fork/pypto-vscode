/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * JSON文件信息
 * totalCycles：时间轴总长度
 * chipArch：内存图类型
 * bufferCapacity：各个buffer内存条的总宽度
*/
export interface MetaData {
    totalCycles: number,
    chipArch: number,
    bufferCapacity: {},
}

/**
 * 时间轴
 * number：序号
 * startTime：开始时间
 * events：时间列表
 * isMultipleEvents：是否多事件
 */
export interface TimeList {
    number: number,
    startTime: number,
    events: [],
    isMultipleEvents: boolean,
}


/**
 * memoryType数据信息
 * memoryType data information
 * The key is the name of memoryType, such as' GM ',' L2 ', etc
 * BufferList refers to the buffers contained within it
 * 
 */
export interface MemoryType {
    [key: string]: {
        size: number,
        bufferList: Buffer[],
    }
};

/**
 * buffer数据信息
 * Buffer data information
 * status: 'initialized' (初始化) or 'valid' (有效)
 */
export interface Buffer {
    memoryId: string,
    startLocation: number,
    size: number,
    status: 'initialized' | 'valid',
    Address: string,
}

/**
 * 动画事件信息
 * Animation event information
 * EventType is the type of event
 * StartTime and endTime are the start time and end time, respectively
 * AnimationData is animation related data, InputMemIds and exportMemIds are the outgoing memoryType and received memoryType, respectively
 * for example AnimationData:
const animationData = [
    {
        inputMemIds: {
            L1: {
                L10: 200,
                L11: 200,
            },
            L2: {
                L20: 50,
                L21: 30,
            }
        },
        outputMemIds: {
            Gm: {
                Gm0: 480,
            }
        }
    },
    {
        inputMemIds: {
            L3: {
                L30: 100,
                L31: 200,
            },
            L2: {
                L50: 20,
                L51: 30,
            }
        },
        outputMemIds: {
            Gm: {
                Gm0: 350,
            }
        }
    },
]
 */



export interface Animation {
    eventType: string,
    startTime: number,
    endTime: number,
    animationData: Array<{
        inputMemIds: Record<string, SimpleBlock | CompositeBlock>,
        outputMemIds: Record<string, SimpleBlock | CompositeBlock>,
    }>,
    errorMemoryType: string[],
}

/**
 * 动画的移动单元信息（简单块）
 * Mobile unit information for simple blocks
 */
interface SimpleAnimationItem {
    [bufferName: string]: number,
}

/**
 * 动画的移动单元信息（复合块）
 * Mobile unit information for composite blocks
 */
interface CompositeAnimationItem {
    [memoryTypeName: string]: SimpleAnimationItem,
}

/**
 * 动画的移动单元信息
 * Mobile unit information of animation
 * Supports both simple blocks (GM, L2) and composite blocks (AIV1, AIC, AIV2)
 */
interface AnimationItem {
    [blockOrMemoryTypeName: string]: SimpleAnimationItem | CompositeAnimationItem,
}

/**
 * memoryType数据信息（简单块，如GM、L2）
 * Simple block containing size and bufferList directly
 */
export interface SimpleBlock {
    size: number,
    bufferList: Buffer[],
}

/**
 * 复合块数据信息（如AIV1、AIC、AIV2）
 * Composite block containing multiple memoryTypes
 */
export interface CompositeBlock {
    [memoryTypeName: string]: SimpleBlock,
}

/**
 * graphData 中块的类型（可以是简单块或复合块）
 * Block type in graphData (can be simple or composite)
 */
export type BlockType = SimpleBlock | CompositeBlock;

/**
 * comGraphMemory 组件入参
 * ComGraphMemory component input parameters
 * You can render the entire image based on this
 */
export interface MemoryGraphData {
    graphData: {
        [blockName: string]: BlockType,
    },
}


export const mockMemoryGraphData: MemoryGraphData = {
    graphData: {
        GM: {
            size: 4194304,
            bufferList: [
                { memoryId: 'GM0', startLocation: 0, size: 4194304, status: 'valid', Address: '0x00000000' },
            ]
        },
        L2: {
            size: 32768,
            bufferList: [
                { memoryId: 'L20', startLocation: 0, size: 32768, status: 'valid', Address: '0x10000000' },
            ]
        },
        AIC: {
            L1: {
                size: 512 ,
                bufferList: [
                    { memoryId: 'L1_0', startLocation: 0, size: 300, status: 'valid', Address: '0x30000000' }
                ]
            },
            L0A: {
                size: 68,
                bufferList: [
                    { memoryId: 'L0A_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000080' }
                ]
            },
            L0B: {
                size: 68,
                bufferList: [
                    { memoryId: 'L0B_0', startLocation: 0, size: 1, status: 'initialized', Address: '0x300000C0' }
                ]
            },
            BT: {
                size: 48,
                bufferList: [
                    { memoryId: 'BT_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000100' }
                ]
            },
            FP: {
                size: 24,
                bufferList: [
                    { memoryId: 'FP_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000140' }
                ]
            },
            CUBE: {
                size: 64,
                bufferList: [
                    { memoryId: 'UBE_0', startLocation: 0, size: 64, status: 'initialized', Address: '0x300001C0' }
                ]
            },
            L0C: {
                size: 256 ,
                bufferList: [
                    { memoryId: 'L0C_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000200' }
                ]
            },
        },
        AIV2: {
            UB: {
                size: 248,
                bufferList: [
                    { memoryId: 'UB_1', startLocation: 0, size: 1, status: 'initialized', Address: '0x400000C0' }
                ]
            },
        }
    }
}
export const mockMemoryGraphData1: MemoryGraphData = {
    graphData: {
        GM: {
            size: 4194304,
            bufferList: [
                { memoryId: 'GM0', startLocation: 0, size: 1, status: 'valid', Address: '0x00000000' },
            ]
        },
        L2: {
            size: 32768,
            bufferList: [
                { memoryId: 'L20', startLocation: 0, size: 2304, status: 'valid', Address: '0x10000000' },
                { memoryId: 'L21', startLocation: 2304, size: 2304, status: 'initialized', Address: '0x10000080' },
            ]
        },
        AIC: {
            L1: {
                size: 512 ,
                bufferList: [
                    { memoryId: 'L1_0', startLocation: 0, size: 100, status: 'valid', Address: '0x30000000' },
                ]
            },
            L0A: {
                size: 68,
                bufferList: [
                    { memoryId: 'L0A_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000080' }
                ]
            },
            L0B: {
                size: 68,
                bufferList: [
                    { memoryId: 'L0B_0', startLocation: 0, size: 1, status: 'initialized', Address: '0x300000C0' }
                ]
            },
            BT: {
                size: 48,
                bufferList: [
                    { memoryId: 'BT_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000100' }
                ]
            },
            FP: {
                size: 24,
                bufferList: [
                    { memoryId: 'FP_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000140' }
                ]
            },
            L0C: {
                size: 256 ,
                bufferList: [
                    { memoryId: 'L0C_0', startLocation: 0, size: 256, status: 'valid', Address: '0x30000200' }
                ]
            },
        },
        AIV2: {
            UB: {
                size: 248,
                bufferList: [
                    { memoryId: 'UB_1', startLocation: 0, size: 1, status: 'initialized', Address: '0x400000C0' }
                ]
            },
        }
    }
}

export const mockMemoryGraphData3: MemoryGraphData = {
    graphData: {
        GM: {
            size: 4194304,
            bufferList: [
                { memoryId: 'GM0', startLocation: 0, size: 1, status: 'valid', Address: '0x00000000' },
            ]
        },
        L2: {
            size: 32768,
            bufferList: [
                { memoryId: 'L20', startLocation: 0, size: 2304, status: 'valid', Address: '0x10000000' },
                { memoryId: 'L21', startLocation: 30464, size: 2304, status: 'initialized', Address: '0x10000080' },
            ]
        },
        AIC: {
            L1: {
                size: 512 ,
                bufferList: [
                    { memoryId: 'L1_0', startLocation: 412, size: 100, status: 'valid', Address: '0x30000000' },
                ]
            },
            L0A: {
                size: 68,
                bufferList: [
                    { memoryId: 'L0A_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000080' }
                ]
            },
            L0B: {
                size: 68,
                bufferList: [
                    { memoryId: 'L0B_0', startLocation: 0, size: 1, status: 'initialized', Address: '0x300000C0' }
                ]
            },
            BT: {
                size: 48,
                bufferList: [
                    { memoryId: 'BT_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000100' }
                ]
            },
            FP: {
                size: 24,
                bufferList: [
                    { memoryId: 'FP_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000140' }
                ]
            },
            L0C: {
                size: 256 ,
                bufferList: [
                    { memoryId: 'L0C_0', startLocation: 0, size: 256, status: 'valid', Address: '0x30000200' }
                ]
            },
        },
        AIV2: {
            UB: {
                size: 248,
                bufferList: [
                    { memoryId: 'UB_1', startLocation: 0, size: 1, status: 'initialized', Address: '0x400000C0' }
                ]
            },
        }
    }
}
export const mockMemoryGraphData2: MemoryGraphData = {
    graphData: {
        GM: {
            size: 4194304,
            bufferList: [
                { memoryId: 'GM0', startLocation: 0, size: 0, status: 'valid', Address: '0x00000000' },
            ]
        },
        L2: {
            size: 32768,
            bufferList: [
                { memoryId: 'L20', startLocation: 0, size: 2304, status: 'initialized', Address: '0x10000000' },
                { memoryId: 'L21', startLocation: 2304, size: 2304, status: 'initialized', Address: '0x10000080' },
            ]
        },
        AIC: {
            L1: {
                size: 512 ,
                bufferList: [
                    { memoryId: 'L1_0', startLocation: 0, size: 100, status: 'valid', Address: '0x30000000' },
                ]
            },
            L0A: {
                size: 68,
                bufferList: [
                    { memoryId: 'L0A_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000080' }
                ]
            },
            L0B: {
                size: 68,
                bufferList: [
                    { memoryId: 'L0B_0', startLocation: 0, size: 1, status: 'initialized', Address: '0x300000C0' }
                ]
            },
            BT: {
                size: 48,
                bufferList: [
                    { memoryId: 'BT_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000100' }
                ]
            },
            FP: {
                size: 24,
                bufferList: [
                    { memoryId: 'FP_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000140' }
                ]
            },
            L0C: {
                size: 256 ,
                bufferList: [
                    { memoryId: 'L0C_0', startLocation: 0, size: 1, status: 'valid', Address: '0x30000200' }
                ]
            },
        },
        AIV2: {
            UB: {
                size: 248,
                bufferList: [
                    { memoryId: 'UB_1', startLocation: 0, size: 1, status: 'initialized', Address: '0x400000C0' }
                ]
            },
        }
    }
}

export const mockAnimationItem: Animation = {
    eventType: 'OP_LAUNCH',
    startTime: 0,
    endTime: 10,
    animationData: [
        {
            inputMemIds: {
                L2: {
                    size: 32768,
                    bufferList: [
                        { memoryId: 'L20', startLocation: 0, size: 2304, status: 'valid', Address: '0x10000000' },
                        { memoryId: 'L21', startLocation: 2304, size: 2304, status: 'valid', Address: '0x10000080' },
                    ]
                }
            },
            outputMemIds: {
                AIC: {
                    L1: { 
                        size: 512 ,
                        bufferList: [
                            { memoryId: 'L1_0', startLocation: 0, size: 100, status: 'valid', Address: '0x30000000' },
                            { memoryId: 'L1_1', startLocation: 100, size: 100, status: 'initialized', Address: '0x30000000' },
                        ]
                    },
                }
            },
        }
    ],
    errorMemoryType: [],
}

export const mockTidyAnimationItem: Animation = {
    eventType: 'BUFFER_REARRANGE',
    startTime: 0,
    endTime: 10,
    animationData: [
        {
            inputMemIds: {
                L2: {
                    size: 32768,
                    bufferList: [
                        { memoryId: 'L20', startLocation: 0, size: 2304, status: 'valid', Address: '0x10000000' },
                        { memoryId: 'L21', startLocation: 2304, size: 2304, status: 'initialized', Address: '0x10000080' },
                    ]
                }
            },
            outputMemIds: {
                AIC: {
                    L1: { 
                        size: 512 ,
                        bufferList: [
                            { memoryId: 'L1_0', startLocation: 0, size: 100, status: 'valid', Address: '0x30000000' },
                        ]
                    },
                }
            },
        }
    ],
    errorMemoryType: [],
}

export const mockErrorAnimationItem: Animation = {
    eventType: 'ALLOC_FALL',
    startTime: 0,
    endTime: 10,
    animationData: [],
    errorMemoryType: ['L2', 'AIC-L1'],
   }


export const mockTimeList = [
    {
      clock: 0,
      events: [
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
      ]
    },
    {
      clock: 0,
      events: [
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10000, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 5142880,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 102400,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 61440,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10000, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 5142880,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 102400,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 61440,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10000, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 5142880,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 102400,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 61440,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
      ]
    },
    {
      clock: 0,
      events: [
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
      ]
    },
    {
      clock: 0,
      events: [
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
        { 
            id: '8', 
            eventType: 'TypeA', 
            startTime: 0, 
            endTime: 10, 
            animationData: {
                inputMemIds: [1850],
                outputMemIds: [1851, 1852],
            }, 
            action: {
                targetBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 1028576,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 20480,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                originBufferList: [
                    {
                        memId: 1850,
                        addStart: 0,
                        size: 524288,
                        status: 1,
                        memType: 'MEM_L2',
                    },
                    {
                        memId: 1851,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L1',
                    },
                    {
                        memId: 1852,
                        addStart: 0,
                        size: 4096,
                        status: 1,
                        memType: 'MEM_L0A',
                    },
                ],
                errorMemType: [],
            } 
        },
      ]
    },
]