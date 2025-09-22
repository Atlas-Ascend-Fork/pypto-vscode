let lastHighlightedNode = null;
const lastHighlightedNodes = [];

// 去除上一次的高亮节点
function removeLastHighlightedNode() {
    if (lastHighlightedNode) {
        d3.select(lastHighlightedNode).classed("highlighted", false);
    }

    if (lastHighlightedNodes.length > 0) {
        lastHighlightedNodes.forEach(node =>{
            d3.select(node).classed("highlighted", false);
        });
        lastHighlightedNodes.length = 0;
    }
}

// 移动视图，确保搜索节点在中间显示
function CenterSelectedNode(node, combinedId) {
    // 获取节点坐标和相关元素
    const gr = window.gr;
    const x = gr._nodes[combinedId].x;
    const y = gr._nodes[combinedId].y;
    console.log("节点位置", {x, y});
    const svg = window.xtrace.graphSVG;

    // 获取容器宽高，计算窗口中心
    const containerWidth = $(document).width();
    const containerHeight = $(document).height();
    const viewportCenterX = containerWidth / 2;
    const viewportCenterY = containerHeight / 2;

    // 设置缩放比例和计算平移坐标
    const desiredScale = 1.5;
    const translateX = viewportCenterX - x * desiredScale;
    const translateY = viewportCenterY - y * desiredScale;
    const transform = `translate(${translateX}, ${translateY}) scale(${desiredScale}, ${desiredScale})`;

    // 设置transform实现平移，并记录zoom状态
    svg.select(".graph").attr("transform", transform);
    const zoom = window.xtrace.zoom;
    zoom.translate([translateX, translateY]).scale(desiredScale);

    console.log("节点已居中显示", {x, y, translateX, translateY, desiredScale});
}

// 按照字段搜索的逻辑
function fieldsSearch(id, nodes, Div) {
    let combinedId = "";
    const filteredNodes = [];
    if (nodes) {
        Object.values(nodes).filter(node => {
            const nodedata = JSON.stringify(node.data);
            if (nodedata.includes(id)){
                combinedId = node.id;
                filteredNodes.push(node);
                const currentElement = d3.select(`.node[data-id='${combinedId}']`).node();
                lastHighlightedNodes.push(currentElement);
                // 设置高亮
                d3.select(currentElement).classed("highlighted", true);
            }
        });

        if (filteredNodes.length > 0) {
            console.log("字段查找显示节点为: ", filteredNodes[filteredNodes.length - 1]);
            const da = JSON.stringify(filteredNodes[filteredNodes.length - 1].data, null, 4);

            var options = {
                collapsed: false,
                enableClipboard: true
            };

            Div.jsonViewer(JSON.parse(da), options);
            const node = filteredNodes[filteredNodes.length - 1];
            CenterSelectedNode(node, combinedId);
        } else {
            Div.html(`<p>没有包含该字段的节点(搜索字段请不要包含</p><p>空格)，请重试</p>`);
        }
    }
    return;
}

// subgraphid 搜索逻辑
function subgraphSearch(id, nodes, Div) {
    let combinedId = "";
    if (nodes) {
        const filteredNodes = Object.values(nodes).filter(node => {
            return node.data && 'subgraphid' in node.data && node.data.subgraphid.toString() === id;
        });

        if (filteredNodes.length > 0) {
            filteredNodes.forEach(node => {
                combinedId = node.id;
                const currentElement = d3.select(`.node[data-id='${combinedId}']`).node();
                lastHighlightedNodes.push(currentElement);
                // 设置高亮
                d3.select(currentElement).classed("highlighted", true);
            });
            console.log("subgraph 显示节点为: ", filteredNodes[filteredNodes.length - 1]);
            const da = JSON.stringify(filteredNodes[filteredNodes.length - 1].data, null, 4);

            var options = {
                collapsed: false,
                enableClipboard: true
            };

            Div.jsonViewer(JSON.parse(da), options);
            const node = filteredNodes[filteredNodes.length - 1];
            CenterSelectedNode(node, combinedId);
        } else {
            Div.html(`<p>不存在节点, 请输入正确的节点id</p>`);
        }
    }
    return;
}

// 其余类型节点搜索逻辑
function nodeSearch(id, nodes, Div){

    if(nodes && Object.keys(nodes).includes(id)){
        const node = nodes[id];
        const currentElement = d3.select(`.node[data-id='${id}']`).node();
        // 设置高亮
        d3.select(currentElement).classed("highlighted", true);
        lastHighlightedNode = currentElement;
        // 显示找到的节点json内容
        const da = JSON.stringify(nodes[id].data, null, 4);
        
        var options = {
            collapsed: false,
            enableClipboard: true
        };

        Div.jsonViewer(JSON.parse(da), options);
        // 节点放到中心显示
        CenterSelectedNode(node, id);
    } else {
        Div.html(`<p>不存在节点, 请输入正确的节点id</p>`);
    }
}