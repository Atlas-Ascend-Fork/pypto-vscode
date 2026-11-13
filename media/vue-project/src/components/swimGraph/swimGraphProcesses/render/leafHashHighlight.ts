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

import SwimDataManager from "../../swimData";
import { getLeafHashList } from "./utils";

// 计算图驱动的 leafHash 高亮所需依赖
export interface LeafHashHighlightDeps {
    swimDataManager: any;
    processExpanded: any;
    ctxs: any;
    changeNodeColor: (processKey: string, isDimmed?: boolean, needText?: boolean) => void;
    drawThreadSeparators: (ctx: any, process: any, processKey: string) => void;
    highlightEvent: (ctx: any, event: any, processKey: string, stroke?: boolean, highlight?: boolean) => void;
}

/**
 * 创建 leafHash 高亮绘制函数
 * - 集合为空： 所有展开 process 恢复正常色
 * - 集合非空： 所有展开 process 置灰，命中 leafHash 的事件高亮
 **/

export function createLeafHashHighlight(deps: LeafHashHighlightDeps) {
    const { swimDataManager, processExpanded, ctxs, changeNodeColor, drawThreadSeparators, highlightEvent } = deps;

    // 三态渲染：全图置灰 → 框内按 dimInBoxOthers 处理 → 全图同 leafHash 高亮（含框外）
    const drawThreeStateHighlight = (
        drawColorDatas: Record<string, any[]>,
        leafHash: string,
        dimInBoxOthers: boolean,
        onInBoxNonMatch?: (event: any, ctx: any, processKey: string) => void,
    ) => {
        swimDataManager.getAllProcesses().forEach((process: any, processKey: string) => {
            if (!processExpanded.get(processKey) || !ctxs[processKey]) {
                return;
            }
            const { eventCtx } = ctxs[processKey];
            // 1. 全图置灰
            changeNodeColor(processKey, true);
            drawThreadSeparators(eventCtx, process, processKey);
            // 2. 框内处理：dimInBoxOthers=false 画原色，true 保持置灰
            const inBoxEvents = drawColorDatas[processKey] || [];
            inBoxEvents.forEach((event: any) => {
                const eventLeafHash = getLeafHashList(event.args?.['event-hint'] ?? '');
                if (leafHash && eventLeafHash === leafHash) {
                    highlightEvent(eventCtx, event, processKey, false, true);
                } else if (!dimInBoxOthers) {
                    highlightEvent(eventCtx, event, processKey, false, false);
                } else if (onInBoxNonMatch) {
                    onInBoxNonMatch(event, eventCtx, processKey);
                }
            });
            // 3. 全图扫描同 leafHash 高亮（含框外）：覆盖步骤 1/2 的灰色/原色，
            // 保证同 hash 无论在框内框外都高亮（label 与 hash 范围可能不一致）
            if (leafHash) {
                process.threads.forEach((thread: any) => {
                    if (thread.isCounter) {
                        return;
                    }
                    const { eventIds } = thread;
                    eventIds.forEach((eventId: string) => {
                        const event = swimDataManager.getEventById(eventId);
                        if (!event || !event.renderInfo || event.renderInfo.processKey !== processKey) {
                            return;
                        }
                        const eventHintStr = event.args?.['event-hint'] ?? '';
                        const eventLeafHash = getLeafHashList(eventHintStr);
                        if (eventLeafHash && eventLeafHash === leafHash) {
                            highlightEvent(eventCtx, event, processKey, false, true);
                        }
                    });
                });
            }
        });
    };

    const drawLeafHashHighlight = (hashSet: Set<string>) => {
        if (!hashSet.size) {
            swimDataManager.getAllProcesses().forEach((process: any, processKey: string) => {
                if (!processExpanded.get(processKey)) {
                    return;
                }
                changeNodeColor(processKey, false);
                const { eventCtx } = ctxs[processKey] ?? {};
                if (eventCtx) {
                    drawThreadSeparators(eventCtx, process, processKey);
                }
            });
            return;
        }
        swimDataManager.getAllProcesses().forEach((process: any, processKey: string) => {
            if (!processExpanded.get(processKey)) {
                return;
            }
            if (!ctxs[processKey]) {
                return;
            }
            const { eventCtx } = ctxs[processKey];
            changeNodeColor(processKey, true);
            drawThreadSeparators(eventCtx, process, processKey);
            process.threads.forEach((thread: any) => {
                if (thread.isCounter) {
                    return;
                }
                const { eventIds } = thread;
                eventIds.forEach((eventId: string) => {
                    const event = swimDataManager.getEventById(eventId);
                    if (!event || !event.renderInfo || event.renderInfo.processKey !== processKey) {
                        return;
                    }
                    const eventHintStr = event.args?.['event-hint'] ?? '';
                    const leafHash = getLeafHashList(eventHintStr);
                    if (leafHash && hashSet.has(leafHash)) {
                        highlightEvent(eventCtx, event, processKey, false, true);
                    }
                });
            });
        });
    };

    return { drawLeafHashHighlight, drawThreeStateHighlight };
}