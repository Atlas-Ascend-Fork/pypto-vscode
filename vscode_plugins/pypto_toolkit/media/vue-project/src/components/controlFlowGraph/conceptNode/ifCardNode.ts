import {
    Diamond,
    type RectStyleProps,
} from '@antv/g6';
import type { BaseCustomElementStyleProps, Group } from '@antv/g-lite';
import { IfCardData, PathCardData } from "@/components/controlFlowGraph/type/node-detail-types";

/**
 *  自定义If卡片hook函数
 */
export function useIfCardNodes() {
    // 自定义节点类（继承菱形），if节点
    class IfCardNode extends Diamond {
        get nodeData() {
            return this.context.graph.getNodeData(this.id) as { data?: PathCardData };
        }

        /**
         *  处理数据默认值
         */
        get cardData(): Required<IfCardData> {
            const rawData = this.nodeData || {};
            return {
                name: 'IF', // 默认，全程改为悬浮提示。
            };
        }

        get data() {
            return this.nodeData.data || {};
        }

        /**
         *  基础卡片样式（覆盖 菱形 默认样式）
         */
        getCardBaseStyle(attributes: RectStyleProps & BaseCustomElementStyleProps) {
            const [width, height] = this.getSize(attributes);

            return {
                fill: 'rgba(246,158,57,0.1)', // 卡片背景色
                stroke: 'rgba(246,158,57,1)', // 卡片边框
                lineWidth: 1,
            };
        }

        // ------------------------------ 顶部路径容器（name + 图标）------------------------------
        /**
         * name名称样式
         */
        getIfLabelStyle(attributes: RectStyleProps & BaseCustomElementStyleProps) {
            const [width] = this.getSize(attributes);
            const topY = -this.getSize(attributes)[1] / 2 + 30; // 顶部 Y 坐标（基于节点中心）
            return {
                x: -7, // 左内边距 20px
                y: 14,
                text: this.cardData.name,
                fontSize: 14,
                fill: '#F9B766', // 原文本色
                fontWeight: 500,
            };
        }

        /**
         * 绘制name容器
         */
        drawIfContainer(attributes: RectStyleProps & BaseCustomElementStyleProps, container: Group) {
            // 绘制路径名称
            this.upsert('path-label', 'text', this.getIfLabelStyle(attributes), container);
        }

        getHoleStyle(attributes) {
            const [width, height] = this.getSize(attributes);

            return {
                points: [
                    [0, -18],
                    [7, -11],
                    [0, -4],
                    [-7, -11],
                ],
                fill: '#F9B766',
                isClosed: true,
                backgroundRadius: 8,
            };
        }

        drawHoleShape(attributes, container) {
            const holeStyle = this.getHoleStyle(attributes, container);
            this.upsert('hole-if', 'polygon', holeStyle, container);
        }

        // ------------------------------ 核心渲染方法（整合所有元素）------------------------------
        render(
            attributes = this.parsedAttributes, container: Group | undefined
        ) {
            // 1. 合并基础样式（覆盖 Rect 默认样式）
            const mergedAttrs = {
                ...attributes,
                ...this.getCardBaseStyle(attributes),
            };
            // 2. 绘制
            super.render(mergedAttrs, container);
            this.drawIfContainer(mergedAttrs, container);
            this.drawHoleShape(mergedAttrs, container);

        }
    }

    return {
        IfCardNode
    }
}