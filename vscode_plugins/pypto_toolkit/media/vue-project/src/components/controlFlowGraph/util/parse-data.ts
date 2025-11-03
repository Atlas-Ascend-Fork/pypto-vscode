import { CombsType, ControlFlowNodesType, EdgesType, GroupNode } from "../type/node-detail-types";


export function transformData(rootNodes: GroupNode): {
    nodes: ControlFlowNodesType[];
    edges: EdgesType[];
    combos: CombsType[];
} {
    const nodes: ControlFlowNodesType[] = [];
    const edges: EdgesType[] = [];
    const combos: CombsType[] = [];
    let lastNodeY = 0;
    let loopRankSep = 0;
    let isFirstNode = false;
    let magicName = '';
    let loopTopCount = 0;
    let loopBottomCount = 0;
    let loopLastPathCount = 0;
    let lastPathBottomCount = 0;


    function traverse(node: GroupNode, parentId: string | null, parentType: string, deepRankSep: number) {
        const id = node.magicName.substring('TENSOR_'.length);
        if (node.nodeType === "LOOP") {
            deepRankSep++;
            loopTopCount++;
        }
        if (parentType === 'LOOP' && node.nodeType === "LOOP") {
            // 生成combs父子节点记录
            const combosRecord: CombsType = {
                id,
                ...(parentId ? {combo: parentId} : {}),
                data: {
                    nodeType: node.nodeType,
                    magic: node.magic,
                    magicName: node.magicName,
                    hash: node.hash,
                    sourceCode: node.sourceCode,
                }
            }
            combos.push(combosRecord)
        }
        //  如果是常规Path节点
        if (node.nodeType === "PATH" && parentType === "LOOP") {
            if (isFirstNode) {
                lastNodeY += loopTopCount * 40 + loopLastPathCount * 25 + 30;
                loopBottomCount = loopTopCount;
                loopTopCount = 0;
                lastPathBottomCount = loopLastPathCount;
                loopLastPathCount = deepRankSep;
                isFirstNode = false;
            } else {
                lastNodeY += loopTopCount * 40 + lastPathBottomCount * 25 + 30;
                loopTopCount = 0;
                lastPathBottomCount = loopLastPathCount;
                loopLastPathCount = deepRankSep;
            }

            let name = node.magicName.substring(node.magicName.indexOf("PATH"));

            //     计算functionStats
            const functionStats = {
                leafFunction: node?.meta?.leafFunctions?.length || 0,
                called: node?.meta?.calledRecords?.length || 0,
                callee: node?.meta?.calleeRecords?.length || 0,
            };

            //     计算errorStats（todo：预留err 对象接口）
            const errorStats = {
            }
            const nodeSize = node.nodeType === "PATH" ? [200, 140 + Object.keys(errorStats).length * 30] : [200, 100]
            let newNode: ControlFlowNodesType = {
                id: node.hash,
                type: 'path-card-node',
                parentId: magicName,
                combo: parentId,
                data: {
                    source: node,
                    name,
                    functionStats,
                    // errorStats,
                },
                style: {
                    x: 30 * deepRankSep,
                    y: lastNodeY,
                },
            }
            lastNodeY += nodeSize[1] + 20
            nodes.push(newNode)
            // nodeMap.set(id,newNode)
            loopRankSep = deepRankSep
            parentType = node.nodeType;
            // 递归子节点
            if (node.children) {
                for (const child of node.children) {
                    traverse(child, id, parentType, deepRankSep)
                }
            }

        }

        // 构建IF嵌套的层级结构。
        function calculateIfNode(root: GroupNode) {
            const levelWidths: number[] = [];

            // 构建队列
            const queue: { node: GroupNode; level: number; }[] = [];
            queue.push({node: root, level: 0});

            while (queue.length > 0) {
                const {node, level} = queue.shift()!;
                if (level >= levelWidths.length) {
                    levelWidths[level] = 0;
                }
                levelWidths[level] += 1;
                //     设置当前节点坐标
                node.x = levelWidths[level];
                node.y = level;

                if (node.children && node.children.length > 0) {
                    const nextLevel = level + 1;
                    const childCount = node.children.length;

                    for (let i = 0; i < childCount; i++) {
                        const child = node.children[i];
                        queue.push({node: child, level: nextLevel});
                    }
                }
            }
            return levelWidths;
        }


        function getLevelWidths(root: GroupNode): number[] {
            const levelWidths: number[] = [];

            const queue: { node: GroupNode; level: number; }[] = [];
            queue.push({node: root, level: 0});

            while (queue.length > 0) {
                const {node, level} = queue.shift()!;

                if (level >= levelWidths.length) {
                    levelWidths[level] = 0;
                }
                levelWidths[level] += 1;
                if (node.children) {
                    for (const child of node.children) {
                        queue.push({node: child, level: level + 1});
                    }
                }

            }
            return levelWidths;
        }


        function drawNode(root: GroupNode) {
            const verticalSpacing = -40;
            const horizontalSpacing = 0;
            const nodeWidth = 200;
            const nodeHeight = 220;
            const levelWidths = calculateIfNode(node);
            const maxLevelWidth = Math.max(...levelWidths);
            const maxLevelPixelWidth = maxLevelWidth * (nodeWidth + horizontalSpacing) - horizontalSpacing;
            const starY = lastNodeY + loopTopCount * 40 + loopLastPathCount * 25 + 30;

            function layoutTree(root: GroupNode, level: number = 0, startX: number) {
                root.y = level;
                if (root.children && root.children.length !== 0) {
                    const offsetIf = root?.children[0]?.nodeType === 'IF' ? 50 : -80;
                    const leftLeafX = startX - horizontalSpacing - nodeWidth - offsetIf;
                    const rightLeafX = startX + horizontalSpacing + nodeWidth + offsetIf;
                    layoutTree(root.children[0], level + 1, leftLeafX);
                    layoutTree(root.children[1], level + 1, rightLeafX);
                }
                let name = '';
                if (root.nodeType === "PATH") {
                    name = root.magicName.substring(root.magicName.indexOf("PATH"));
                }
                //     计算functionStats
                const functionStats = {
                    leafFunction: root?.meta?.leafFunctions?.length || 0,
                    called: root?.meta?.calledRecords?.length || 0,
                    callee: root?.meta?.calleeRecords?.length || 0,
                };
                //     计算errorStats（todo:本版本无err，预留接口）
                const errorStats = {
                }
                const nodeSize = root.nodeType === "PATH" ? [200, 140 + Object.keys(errorStats).length * 30] : [200, 100]
                loopRankSep = deepRankSep
                if (root.x !== undefined && root.y !== undefined) {
                    root.hash = root.hash === '' ? `${root.x}${root.y}${parentId}` : root.hash
                    let newNode: ControlFlowNodesType = {
                        id: root.hash,
                        type: root.nodeType === "PATH" ? 'path-card-node' : 'if-card-node',
                        parentId: magicName,
                        combo: parentId,
                        data: {
                            source: root,
                            name,
                            functionStats,
                            errorStats,
                        },
                        style: {
                            x: startX + 25 * deepRankSep,
                            y: starY + root.y * (nodeHeight + verticalSpacing),
                        },
                    }
                    root.x = startX;
                    root.y = starY + root.y * (nodeHeight + verticalSpacing);
                    lastNodeY = Math.max((newNode.style.y), lastNodeY)
                    if (root.nodeType === "IF") {
                        newNode.data = {
                            ...newNode.data,
                            type: 'IF-CARD'
                        }
                    } else {
                        newNode.data = {
                            ...newNode.data,
                            type: 'IF-PATH'
                        }
                    }
                    nodes.push(newNode)
                }
            }
            const queue: GroupNode[] = [root];
            layoutTree(root, 0, maxLevelPixelWidth / 2)
        }

        //  如果是if嵌套节点
        if (node.nodeType === "IF" || (node.nodeType === "PATH" && parentType === "IF")) {
            if (isFirstNode) {
                drawNode(node)
                lastNodeY += loopTopCount * 40 + loopLastPathCount * 25 + 30;
                loopBottomCount = loopTopCount;
                loopTopCount = 0;
                lastPathBottomCount = loopLastPathCount;
                loopLastPathCount = deepRankSep;
                isFirstNode = false;
            } else if (parentType === "LOOP") {
                drawNode(node)
                lastNodeY += loopTopCount * 40 + loopLastPathCount * 25 + 30;
                loopTopCount = 0;
                lastPathBottomCount = loopLastPathCount;
                loopLastPathCount = deepRankSep;
            }
        }

        parentType = node.nodeType;
        // 递归子节点
        if (node.children) {
            for (const child of node.children) {
                traverse(child, node.nodeType === "IF" ? parentId : id, parentType, deepRankSep)
            }
        }

    }

    // 遍历所有根节点
    for (const root of rootNodes) {
        magicName = root.magicName;
        isFirstNode = true;
        traverse(root, null, "LOOP", 0)
    }

    // 构建edges数组，按顺序构建path与if
    for (let i = 0; i < nodes.length; i++) {
        const current = nodes[i];
        const next = nodes[i + 1];
        if (next && current.type === "path-card-node" && current.type === next.type) {
            if (current.data?.type === 'IF-PATH') {
                continue;
            }
            edges.push({
                source: current.id,
                target: next.id,
                style: {lineWidth: 0, opacity: 0}
            })
        } else if (next && current.type === "path-card-node" && next.type === "if-card-node") {
            if (current.data?.type === 'IF-PATH') {
                continue;
            }
            edges.push({
                source: current.id,
                target: next.id,
                style: {lineWidth: 0, opacity: 0}
            });
        } else if (next && current.type === "path-card-node" && current.data?.type === 'IF-PATH') {
            // if节点下的最后一个Path指向下一个非'IF-PATH'类型节点
            if (next.data?.type === 'IF-PATH') {
                continue;
            }
            edges.push({
                source: current.id,
                target: next.id,
            });
        }
    }

    //  构建if节点指向子节点
    for (const node of nodes) {
        if (node.type === "if-card-node" && node.data.source.children) {
            for (const child of node.data.source.children) {
                const childId = child.hash;
                edges.push({
                    source: node.id,
                    target: childId,
                    type: 'polyline',
                    style: {
                        lineWidth: 1,
                        radius: 20,
                        stroke: '#666666',
                        opacity:0.8,
                        controlPoints: [[node.style.x, (node.style.y + child.y) / 2]],
                        endArrow: true,
                        router: {
                            type: 'orth',
                        },
                    }
                })
            }
        }

    }

    return {nodes, edges, combos}

}