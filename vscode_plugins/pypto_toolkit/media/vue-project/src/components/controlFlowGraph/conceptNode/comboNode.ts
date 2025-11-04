import { inject, ref } from 'vue';
import { RectCombo } from '@antv/g6';
import { PathCardData } from "@/components/controlFlowGraph/type/node-detail-types";
import { getThemeColorTool } from "@/components/controlFlowGraph/util/getTheme";

/**
 * 自定义组合节点hook函数
 */
export function useComboCardNodes() {
    const { isDarkTheme } = inject('root');
    const loopLeftSvg = ref(`${window.staticPath}/static-assets/loop.svg`);
    const loopLeftSvgLight = ref(`${window.staticPath}/static-assets/loop-light.svg`);
    // 自定义组合
    class LogoWithRectCombo extends RectCombo {
        /**
         *  获取节点原始数据
         */
        get nodeData() {
            return this.context.graph.getNodeData(this.id) as { data?: PathCardData };
        }

        async drawButton(attributes) {
            const [width, height] = this.getKeySize(attributes);
            const btnR = 8;
            const y = -height / 2;
            const x = -width / 2 + 10;
            const states = this.nodeData.states;
            let isSelected = false;
            let isActived = false;
            if (states && states.length > 0) {
                isSelected = states.includes('selected');
                isActived = states.includes('active');
            }

            const buttonBlue = getThemeColorTool('control-flow-loop-title-bg-active', isDarkTheme.value);
            const buttonWeak = getThemeColorTool('control-flow-loop-title-bg-weak', isDarkTheme.value);
            const textBlue = getThemeColorTool('control-flow-loop-title-text-hover', isDarkTheme.value);
            const textWeak = getThemeColorTool('control-flow-loop-title-text', isDarkTheme.value);

            let loopLeftIcon=isDarkTheme.value ? loopLeftSvg.value : loopLeftSvgLight.value;
            let isActivedTextColor = isActived ? textBlue : textWeak;
            let isSelectedHitAreaColor = isSelected ? buttonBlue : buttonWeak;
            if (isSelected) {
                isActivedTextColor = '#FFFFFF' //深色、浅色，loop选中时title颜色一致
                loopLeftIcon=loopLeftSvg.value;
            }

            // loop标签背景色板
            const hitArea = this.upsert('hit-area', 'rect', {
                y: y - 15,
                x,
                width: 20 + this.id.length * 10.3,
                height: 35,
                radius: 8,
                fill: isSelectedHitAreaColor
            }, this);
            // loop标签左图片
            const leftImage = this.upsert('left-svg', 'image', {
                y: y - 8,
                x: x + 10,
                width: 20,
                height: 20,
                src: loopLeftIcon,
            }, this)
            // loop标签文本
            const text = await this.upsert('loop-text', 'text', {
                y: y + 12,
                x: x + 35,
                text: this.id,
                fill: isActivedTextColor,
                fontSize: 16
            }, this)
        }


        render(attributes, container) {
            super.render(attributes, container);
            const shape = this.drawButton(attributes);
        }
    }
    return {
        LogoWithRectCombo
    }
}