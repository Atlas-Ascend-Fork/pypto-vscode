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
import { TensorSearchOverlayUtil } from './TensorSearchOverlayUtil';
import { MemoryRegionLayoutUtil } from './memoryRegionLayoutUtil';

interface TensorAddressGuideOptions {
  getChart: () => any;
  getIsDarkTheme: () => boolean;
  getSelectedRegion: () => any;
}

export class TensorAddressGuide {
  private readonly idPrefix = 'tensor-address-guide';
  private hoveredTensorRow: any[] | null = null;
  private guideId: string | null = null;
  private sequence = 0;

  constructor(private readonly options: TensorAddressGuideOptions) {}

  clear(): void {
    this.hoveredTensorRow = null;
    const chart = this.options.getChart();
    if (chart && this.guideId) {
      chart.setOption({ graphic: [{ id: this.guideId, $action: 'remove' }] });
    }
    this.guideId = null;
  }

  render(): void {
    const chart = this.options.getChart();
    const selectedRegion = this.options.getSelectedRegion();
    if (!chart || !selectedRegion || !this.hoveredTensorRow) {
      return;
    }

    const gridRect = TensorSearchOverlayUtil.getChartGridRect(chart);
    const startY = chart.convertToPixel({ yAxisIndex: 0 }, Number(this.hoveredTensorRow[3]));
    const endY = chart.convertToPixel({ yAxisIndex: 0 }, Number(this.hoveredTensorRow[4]));
    if (!gridRect || !Number.isFinite(startY) || !Number.isFinite(endY)) {
      return;
    }

    if (this.guideId) {
      chart.setOption({ graphic: [{ id: this.guideId, $action: 'remove' }] });
    }
    const guideId = `${this.idPrefix}-${++this.sequence}`;
    const lineColor = this.options.getIsDarkTheme() ? 'rgba(230, 230, 230, 0.8)' : 'rgba(25, 25, 25, 0.7)';
    const labelBackground = this.options.getIsDarkTheme() ? 'rgba(54, 54, 54, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const rawTensor = this.hoveredTensorRow[17] || {};
    const startAddress = Number.isFinite(Number(rawTensor.base))
      ? Number(rawTensor.base)
      : MemoryRegionLayoutUtil.toAbsoluteAddress(this.hoveredTensorRow[3], selectedRegion);
    const endAddress = Number.isFinite(Number(rawTensor.end))
      ? Number(rawTensor.end)
      : MemoryRegionLayoutUtil.toAbsoluteAddress(this.hoveredTensorRow[4], selectedRegion);
    const createChildren = (y: number, address: number, suffix: string) => [
      {
        id: `${guideId}-${suffix}-line`,
        type: 'line',
        silent: true,
        shape: { x1: gridRect.x, y1: y, x2: gridRect.x + gridRect.width, y2: y },
        style: { stroke: lineColor, lineWidth: 1, lineDash: [6, 4] },
      },
    ];

    chart.setOption({
      graphic: [
        {
          id: guideId,
          type: 'group',
          silent: true,
          z: 400,
          children: [...createChildren(startY, startAddress, 'start'), ...createChildren(endY, endAddress, 'end')],
        },
      ],
    });
    this.guideId = guideId;
  }

  show(tensorRow: any): void {
    if (!this.options.getSelectedRegion() || !Array.isArray(tensorRow)) {
      this.clear();
      return;
    }
    this.hoveredTensorRow = tensorRow;
    this.render();
  }

  clearForRow(tensorRow: any): void {
    if (tensorRow === this.hoveredTensorRow || tensorRow?.[17] === this.hoveredTensorRow?.[17]) {
      this.clear();
    }
  }

  reset(): void {
    this.hoveredTensorRow = null;
    this.guideId = null;
  }
}
