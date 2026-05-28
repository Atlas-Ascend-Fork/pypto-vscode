<template>
  <div class="grid-node-container" :style="getNodeContainerStyles(data)" @mouseenter="hoverFunc(true)" @mouseleave="hoverFunc(false)">
    <Handle
      v-for="h in data.handles || []"
      :key="h.id"
      :id="h.id"
      :type="h.type || 'source'"
      :position="getHandlePosition(h.edge)"
      :style="getHandleStyle(h)"
    />

    <Teleport to="body">
      <div v-if="hovered && hoveredBufferInfo" class="node-popup" :style="popupStyle">
      <div class="popup-header">
        <span class="popup-title">Buffer Info</span>
      </div>
      <div class="popup-row">
        <span class="popup-key">memId</span>
        <span class="popup-val">{{ hoveredBufferInfo.memId }}</span>
      </div>
      <div class="popup-row">
        <span class="popup-key">memType</span>
        <span class="popup-val">{{ hoveredBufferInfo.memType }}</span>
      </div>
      <div class="popup-row">
        <span class="popup-key">addrStart</span>
        <span class="popup-val">{{ hoveredBufferInfo.addrStart }}</span>
      </div>
      <div class="popup-row">
        <span class="popup-key">size</span>
        <span class="popup-val">{{ hoveredBufferInfo.size }}KB</span>
      </div>
      <div class="popup-row">
        <span class="popup-key">status</span>
        <span class="popup-val">{{ hoveredBufferInfo.status }}</span>
      </div>
    </div>
    </Teleport>

    <div class="grid-layout-wrapper" :style="layoutStyles(data.layoutStyles)">
      <div v-if="data.showHeader" class="node-header">
        <div class="header-left">
          <span class="header-label">{{ data.label || 'UB' }}</span>
          <span v-if="data.subLabel" class="header-sublabel">{{ data.subLabel }}</span>
        </div>
        <div class="header-stats">
          <div class="header-stats" v-if="data.showStats">
            <span class="percentage">{{ mainPercentage }}%</span>
            <span class="values">{{ data.filledCount || 0 }}KB / {{ mainTotalCells }}KB</span>
          </div>
          <span
            v-if="data.headerBadge"
            class="header-badge"
            :style="{
              backgroundColor: data.headerBadge.bgColor || '#f97316',
              color: data.headerBadge.color || '#ffffff',
            }"
            @click="onBadgeClick"
          >
            <ArrowIcon v-if="data.headerBadge.icon" :width="12" :height="12" style="transform: rotate(180deg)" />
            <span class="badge-text">{{ data.headerBadge.text }}</span>
          </span>
        </div>
      </div>
      <div class="grid-section" :style="getGridSectionStyles(data)">
        <div class="grid-wrapper" :style="getGridStyles(data)">
          <div v-for="index in mainTotalCells" :key="'g1-' + index" class="grid-cell" @mouseenter="(e) => hoverCell(index, e)" @mouseleave="hoverCell(null, null)">
            <svg v-if="data.shape === 'hexagon'" viewBox="0 0 100 100" class="hexagon-svg">
              <path
                d="M25,2 L75,2 Q80,2 85,10 L100,45 Q102,50 100,55 L85,90 Q80,98 75,98 L25,98 Q20,98 15,90 L0,55 Q-2,50 0,45 L15,10 Q20,2 25,2 Z"
                :fill="getCellColor(data, index, mainAnimatedCount, mainAnimatedCells, mainAnimatedColors)"
              />
            </svg>
            <div
              v-else
              class="square-cell"
              :style="{
                backgroundColor: getCellColor(data, index, mainAnimatedCount, mainAnimatedCells, mainAnimatedColors),
                borderRadius: data.shape === 'circle' ? '50%' : '1px',
              }"
            ></div>
          </div>
          <div v-if="!data.showHeader" class="center-label" :style="data.badgeStyle">
            <div v-if="data.centerIcon" class="center-icon">
              <ArrowIcon :width="16" style="transform: rotate(180deg)" />
              <span>{{ data.label || 'L1' }}</span>
            </div>
            <span v-else>{{ data.label || 'L1' }}</span>
            <span v-if="data.subBadgeLabel" class="sub-badge" :style="data.subBadgeStyle">{{ data.subBadgeLabel || '32M' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="data.splitData" class="grid-layout-wrapper" :style="layoutStyles(data.splitData.layoutStyles)">
      <div v-if="data.splitData.showHeader" class="node-header">
        <span class="header-label">{{ data.splitData.label || 'UB' }}</span>
        <div class="header-stats" v-if="data.splitData.headerStats">
          <span class="percentage">{{ mainPercentage }}%</span>
          <span class="values">{{ data.filledCount || 0 }}KB / {{ mainTotalCells }}KB</span>
        </div>
      </div>
      <div class="grid-section" :style="getGridSectionStyles(data.splitData)">
        <div class="grid-wrapper" :style="getGridStyles(data.splitData)">
          <div v-for="index in splitTotalCells" :key="'g2-' + index" class="grid-cell">
            <svg v-if="(data.splitData.shape || data.shape) === 'hexagon'" viewBox="0 0 100 100" class="hexagon-svg">
              <path
                d="M25,2 L75,2 Q80,2 85,10 L100,45 Q102,50 100,55 L85,90 Q80,98 75,98 L25,98 Q20,98 15,90 L0,55 Q-2,50 0,45 L15,10 Q20,2 25,2 Z"
                :fill="getCellColor(data.splitData, index, splitAnimatedCount, splitAnimatedCells, splitAnimatedColors)"
              />
            </svg>
            <div
              v-else
              class="square-cell"
              :style="{
                backgroundColor: getCellColor(data.splitData, index, splitAnimatedCount, splitAnimatedCells, splitAnimatedColors),
                borderRadius: (data.splitData.shape || data.shape) === 'circle' ? '50%' : '1px',
              }"
            ></div>
          </div>

          <div v-if="!data.splitData.showHeader" class="center-label" :style="data.splitData.badgeStyle">
            <span>{{ data.splitData.label || 'L1' }}</span>
            <span v-if="data.splitData.subBadgeLabel" class="sub-badge" :style="data.splitData.subBadgeStyle">{{
              data.splitData.subBadgeLabel || '32M'
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Handle, Position } from '@vue-flow/core';
import ArrowIcon from '../icons/arrow-icon.vue';

export default {
  name: 'GridNode',
  components: { Handle, ArrowIcon },
  props: {
    id: { type: String, required: true },
    data: { type: Object, required: true },
  },
  data() {
        return {
          Position,
          hovered: false,
          hoveredCellIndex: null,
          hoveredBufferInfo: null,
          mouseX: 0,
          mouseY: 0,
          mainAnimatedCount: 0,
      splitAnimatedCount: 0,
      mainAnimatedCells: new Set(),
      splitAnimatedCells: new Set(),
      mainAnimatedColors: new Map(),
      splitAnimatedColors: new Map(),
      intervals: { main: null, split: null },
      timeouts: { main: null, split: null },
      cellSize: 10,
      gap: 2,
    };
  },
  computed: {
    mainTotalCells() {
      return (this.data.cols || 10) * (this.data.rows || 20);
    },
    splitTotalCells() {
      if (!this.data.splitData) return 0;
      return (this.data.splitData.cols || 10) * (this.data.splitData.rows || 20);
    },
    mainPercentage() {
      return Math.round(((this.data.filledCount || 0) / this.mainTotalCells) * 100) || 0;
    },
    accessType() {
      return this.data.detail?.access || 'read';
    },
    popupStyle() {
      const offset = 5;
      
      // 默认：popup 左上角在鼠标右下方
      let left = this.mouseX + offset;
      let top = this.mouseY + offset;
      
      // 右边界不够时，popup 左上角移动到鼠标左下方
      if (left + 140 > window.innerWidth) {
        left = this.mouseX - 140 - offset;
      }
      
      // 下边界不够时，popup 左上角移动到鼠标左上方
      if (top + 180 > window.innerHeight) {
        top = this.mouseY - 180 - offset;
      }
      
      return {
        left: `${left}px`,
        top: `${top}px`,
        transform: 'none'
      };
    },
  },
  mounted() {
    this.initAnimations();
  },
  methods: {
    onBadgeClick() {
      this.$emit('badge-click', this.data.headerBadge);
    },
    hoverFunc(isHover) {
      this.hovered = isHover;
    },
    hoverCell(index, event) {
      if (this.data.splitData) {
        this.hoveredBufferInfo = null;
        return;
      }
      if (index === null) {
        this.hoveredCellIndex = null;
        this.hoveredBufferInfo = null;
      } else {
        this.hoveredCellIndex = index;
        if (event) {
          this.mouseX = event.clientX;
          this.mouseY = event.clientY;
        }
        const statusMap = {
          0: '未分配',
          1: '已分配未占用',
          2: '已分配且已占用',
        }
        const tiers = this.data.animate === true 
          ? (this.data.animationData?.targetTiers || [])
          : (this.data.tiers || []);
        for (let i = 0; i < tiers.length; i++) {
          const tier = tiers[i];
          const startLocation = Math.floor(tier.startLocation ?? 0);
          const size = Math.round(tier.size ?? 0);
          if (index > startLocation && index <= startLocation + size) {
            const bufferMsg = tier.bufferMsg || {};
            if (bufferMsg.status === 0) {
              this.hoveredBufferInfo = null;
              return;
            } 
            this.hoveredBufferInfo = {
              memId: bufferMsg.memId || '',
              addrStart: bufferMsg.addrStart / 1024 || 0,
              memType: bufferMsg.memType || '',
              size: bufferMsg.size / 1024 || 0,
              status: statusMap[bufferMsg.status || 0],
            };
            return;
          }
        }
        this.hoveredBufferInfo = null;
      }
    },
    getHandlePosition(edge) {
      return (
        {
          top: Position.Top,
          bottom: Position.Bottom,
          left: Position.Left,
          right: Position.Right,
        }[edge] || Position.Top
      );
    },
    getHandleStyle(h) {
      const { pct } = h;
      const formattedPct = isNaN(pct) ? pct : `${pct}%`;
      if (h.edge === 'top' || h.edge === 'bottom') {
        return {
          position: 'absolute',
          left: formattedPct,
          top: h.edge === 'top' ? '0%' : undefined,
          bottom: h.edge === 'bottom' ? '0%' : undefined,
          transform: 'translate(-50%, -50%)',
        };
      } else {
        return {
          position: 'absolute',
          top: formattedPct,
          left: h.edge === 'left' ? '0%' : undefined,
          right: h.edge === 'right' ? '0%' : undefined,
          transform: 'translate(-50%, -50%)',
        };
      }
    },
    getNodeContainerStyles(config) {
      return { flexDirection: config.splitType === 'horizontal' ? 'row' : 'column', ...config.nodeContainerStyle };
    },
    getGridSectionStyles(config) {
      return { backgroundColor: config.bgColor || '', ...config.gridSectionStyle };
    },
    layoutStyles(styles) {
      return { display: 'flex', flexDirection: 'column', gap: '4px', ...styles };
    },
    getCellColor(config, index, animatedCount, animatedCells, animatedColors) {
      const empty = config.emptyColor || '#4a90e244';
      const filled = config.filledColor || '#5ea3ef';
      const tiers = Array.isArray(config.tiers) ? config.tiers : null;

      const tierColor = () => {
        if (animatedColors instanceof Map && animatedColors.has(index)) {
          return animatedColors.get(index);
        }
        if (tiers && tiers.length) {
          for (const t of tiers) {
            const start = Math.floor(t.startLocation ?? 0) + 1;
            const size = Math.round(t.size ?? 0);
            if (index >= start && index <= start + size - 1) {
              return t.color || filled;
            }
          }
        }
        return filled;
      };
      const animateUntil = config.animateUntil;
      if (typeof animateUntil === 'number' && index > animateUntil) {
        return tierColor();
      }

      if (animatedCells instanceof Set) {
        if (!animatedCells.has(index)) {
          if (animatedColors instanceof Map && animatedColors.has(index)) {
            return animatedColors.get(index);
          }
          return empty;
        }
      } else if (index > animatedCount) {
        if (animatedColors instanceof Map && animatedColors.has(index)) {
          return animatedColors.get(index);
        }
        return empty;
      }
      return tierColor();
    },
    getGridStyles(config) {
      return {
        display: 'grid',
        gridTemplateColumns: `repeat(${config.cols || 10}, ${this.cellSize}px)`,
        gridAutoRows: `${this.cellSize}px`,
        gap: `${this.gap}px`,
        position: 'relative',
      };
    },
    initAnimations() {
      const animateMain = this.data.animate === true;
      if (!animateMain) {
        this.mainAnimatedCount = this.data.filledCount != null ? this.data.filledCount : this.mainTotalCells;
        this.mainAnimatedCells = this.getCellsFromTiers(this.data.tiers || [], this.mainTotalCells);
        this.mainAnimatedColors = this.getCellsWithColor(this.data.tiers || [], this.mainTotalCells);
      } else {
        this.startAnimation('main', this.data.speed);
      }
      if (this.data.splitData) {
        const animateSplit = this.data.splitData.animate === true;
        if (!animateSplit) {
          this.splitAnimatedCount = this.data.splitData.filledCount != null ? this.data.splitData.filledCount : this.splitTotalCells;
          this.splitAnimatedCells = this.getCellsFromTiers(this.data.splitData.tiers || [], this.splitTotalCells);
          this.splitAnimatedColors = this.getCellsWithColor(this.data.splitData.tiers || [], this.splitTotalCells);
        } else {
          this.startAnimation('split', this.data.splitData.speed || this.data.speed);
        }
      }
    },
  getCellsFromTiers(tiers, totalCells) {
    const cells = new Set();
    if (!tiers || !Array.isArray(tiers)) return cells;
    
    for (const tier of tiers) {
      const start = Math.floor(tier.startLocation || 0) + 1;
      const size = Math.round(tier.size || 0);
      for (let i = 0; i < size && start + i <= totalCells; i++) {
        cells.add(start + i);
      }
    }
    return cells;
  },
  
  getCellsWithColor(tiers, totalCells) {
    const cells = new Map();
    if (!tiers || !Array.isArray(tiers)) return cells;
    
    for (const tier of tiers) {
      const start = Math.floor(tier.startLocation || 0) + 1;
      const size = Math.round(tier.size || 0);
      const color = tier.color || '#5ea3ef';
      for (let i = 0; i < size && start + i <= totalCells; i++) {
        cells.set(start + i, color);
      }
    }
    return cells;
  },
  
  startAnimation(type, speed) {
    const countKey = type === 'main' ? 'mainAnimatedCount' : 'splitAnimatedCount';
    const cellsKey = type === 'main' ? 'mainAnimatedCells' : 'splitAnimatedCells';
    const colorsKey = type === 'main' ? 'mainAnimatedColors' : 'splitAnimatedColors';
    const cfg = type === 'main' ? this.data : this.data.splitData || {};
    const totalCells = type === 'main' ? this.mainTotalCells : this.splitTotalCells;
    const animationSpeed = cfg.animationData?.animationSpeed || 1;
    
    const originTiers = cfg.animationData?.originTiers || [];
    const targetTiers = cfg.animationData?.targetTiers || [];
    const stepCount = cfg.animationData?.stepCount || 6;
    const isError = cfg.animationData?.error || false;
    const pauseMs = cfg.pauseMs != null ? cfg.pauseMs : 0;
    
    if (this.intervals[type]) clearInterval(this.intervals[type]);
    if (this.timeouts[type]) clearTimeout(this.timeouts[type]);
    
    const originCellsWithColor = this.getCellsWithColor(originTiers, totalCells);
    const originCells = new Set(originCellsWithColor.keys());
    
    this[cellsKey] = new Set(originCells);
    this[colorsKey] = new Map(originCellsWithColor);
    this[countKey] = originCells.size;
    
    if (isError) {
      const errorColor = '#FF0000';
      const emptyColor = cfg.emptyColor || '#4a90e244';
      let isErrorState = false;
      let flashCount = 0;
      const maxFlashes = 8;
      
      const tick = () => {
        this.intervals[type] = setInterval(() => {
          isErrorState = !isErrorState;
          
          for (let i = 1; i <= totalCells; i++) {
            if (!this[cellsKey].has(i)) {
              this[colorsKey].set(i, isErrorState ? errorColor : emptyColor);
            }
          }
          
          if (isErrorState) {
            flashCount++;
            if (flashCount >= maxFlashes) {
              clearInterval(this.intervals[type]);
              this.intervals[type] = null;
              for (let i = 1; i <= totalCells; i++) {
                if (!this[cellsKey].has(i)) {
                  this[colorsKey].delete(i);
                }
              }
            }
          }
        }, 300 / animationSpeed);
      };
      
      tick();
      
      return;
    }
    
    const targetCellsWithColor = this.getCellsWithColor(targetTiers, totalCells);
    const targetCells = new Set(targetCellsWithColor.keys());
    
    const cellsToRemove = new Set([...originCells].filter(c => !targetCells.has(c)));
    const cellsToAdd = new Set([...targetCells].filter(c => !originCells.has(c)));
    
    const colorGroupsToRemove = {};
    for (const cell of cellsToRemove) {
      const color = originCellsWithColor.get(cell) || '#5ea3ef';
      if (!colorGroupsToRemove[color]) {
        colorGroupsToRemove[color] = [];
      }
      colorGroupsToRemove[color].push(cell);
    }
    
    const colorGroupsToAdd = {};
    for (const cell of cellsToAdd) {
      const color = targetCellsWithColor.get(cell) || '#5ea3ef';
      if (!colorGroupsToAdd[color]) {
        colorGroupsToAdd[color] = [];
      }
      colorGroupsToAdd[color].push(cell);
    }
    
    const colorChangeCells = {};
    for (const cell of [...originCells].filter(c => targetCells.has(c))) {
      const originColor = originCellsWithColor.get(cell);
      const targetColor = targetCellsWithColor.get(cell);
      if (originColor !== targetColor) {
        if (!colorChangeCells[originColor]) {
          colorChangeCells[originColor] = [];
        }
        colorChangeCells[originColor].push({ cell, targetColor });
      }
    }
    
    this[cellsKey] = new Set(originCells);
    this[colorsKey] = new Map(originCellsWithColor);
    this[countKey] = originCells.size;
    
    const tick = () => {
      this.intervals[type] = setInterval(() => {
        let updated = false;
        
        for (const color of Object.keys(colorGroupsToRemove)) {
          const group = colorGroupsToRemove[color];
          if (group.length > 0) {
            for (let i = 0; i < stepCount && group.length > 0; i++) {
              const cell = group.shift();
              this[cellsKey].delete(cell);
              this[colorsKey].delete(cell);
              updated = true;
            }
          }
        }
        
        for (const originColor of Object.keys(colorChangeCells)) {
          const group = colorChangeCells[originColor];
          if (group.length > 0) {
            for (let i = 0; i < stepCount && group.length > 0; i++) {
              const { cell, targetColor } = group.shift();
              this[colorsKey].set(cell, targetColor);
              updated = true;
            }
          }
        }
        
        for (const color of Object.keys(colorGroupsToAdd)) {
          const group = colorGroupsToAdd[color];
          if (group.length > 0) {
            for (let i = 0; i < stepCount && group.length > 0; i++) {
              const cell = group.shift();
              this[cellsKey].add(cell);
              this[colorsKey].set(cell, color);
              updated = true;
            }
          }
        }
        
        this[countKey] = this[cellsKey].size;
        
        const hasRemaining = Object.values(colorGroupsToRemove).some(g => g.length > 0) ||
                           Object.values(colorChangeCells).some(g => g.length > 0) ||
                           Object.values(colorGroupsToAdd).some(g => g.length > 0);
        
        if (!updated || !hasRemaining) {
          clearInterval(this.intervals[type]);
          this.intervals[type] = null;
        }
      }, speed || 50);
    };
    
    tick();
  },
  },
  beforeDestroy() {
    Object.values(this.intervals).forEach((i) => i && clearInterval(i));
    Object.values(this.timeouts).forEach((t) => t && clearTimeout(t));
  },
  watch: {
    'data.filledCount'(v) {
      if (this.data.animate === true) {
        this.startAnimation('main', this.data.speed);
      } else {
        this.mainAnimatedCount = v != null ? v : this.mainTotalCells;
      }
    },
    'data.splitData.filledCount'(v) {
      if (this.data.splitData?.animate === true) {
        this.startAnimation('split', this.data.splitData?.speed || this.data.speed);
      } else {
        this.splitAnimatedCount = v != null ? v : this.splitTotalCells;
      }
    },
    'data.tiers': function(newTiers) {
      if (this.data.animate !== true) {
        this.mainAnimatedCells = this.getCellsFromTiers(newTiers || [], this.mainTotalCells);
        this.mainAnimatedColors = this.getCellsWithColor(newTiers || [], this.mainTotalCells);
      }
    },
    'data.splitData.tiers': function(newTiers) {
      if (this.data.splitData?.animate !== true) {
        this.splitAnimatedCells = this.getCellsFromTiers(newTiers || [], this.splitTotalCells);
        this.splitAnimatedColors = this.getCellsWithColor(newTiers || [], this.splitTotalCells);
      }
    },
    data: {
      handler() {
        this.initAnimations();
      },
      deep: true
    }
  },
};
</script>

<style scoped>
.grid-node-container {
  display: flex;
  gap: 12px;
  width: max-content;
  flex-direction: column;
  box-sizing: border-box;
  position: relative;
}
.grid-layout-wrapper {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 4px;
  position: relative;
  color: white;
  font-family: 'Inter', sans-serif;
}
.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2px;
  white-space: nowrap;
  gap: 4px;
}
.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.header-label {
  font-weight: bold;
  font-size: 16px;
}
.header-sublabel {
  font-size: 9px;
  color: #9ca3af;
}
.header-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}
.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  transition: filter 0.15s ease;
}
.header-badge:hover {
  filter: brightness(1.1);
}
.badge-icon {
  display: inline-flex;
  align-items: center;
}
.percentage {
  color: #4ade80;
}
.values {
  color: #ffffff;
}
.grid-section {
  background: #4a90e211;
  border: 1.5px solid #4a90e266;
  border-radius: 6px;
  padding: 2px;
  width: max-content;
  box-sizing: border-box;
}
.grid-wrapper {
  width: max-content;
}
.grid-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  transform: rotate(90deg);
}
.hexagon-svg {
  width: 100%;
  height: 100%;
  transition: fill 0.2s ease;
}
.square-cell {
  width: 100%;
  height: 100%;
  transition: background-color 0.2s ease;
}
.center-label {
  text-align: center;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #3b82f6;
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  flex-direction: column;
  font-weight: bold;
  font-size: 24px;
  z-index: 10;
  pointer-events: none;
}
.center-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.sub-badge {
  display: flex;
  font-size: 14px;
  font-weight: 700;
  color: rgba(220, 220, 220, 1);
  letter-spacing: 0.06em;
  border-radius: 999px;
  padding: 2px 4px;
  margin-top: 2px;
}

/* POPUP */
.node-popup {
  position: fixed;
  z-index: 999999;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  padding: 12px;
  min-width: 140px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
.popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #555;
  margin-left: 2px;
  margin-right: 2px;
}

.popup-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}
.popup-title {
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  font-family: 'Inter', sans-serif;
}
.popup-dot {
  color: #888;
  font-size: 12px;
}
.popup-type {
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  font-family: 'Inter', sans-serif;
}

.popup-row:last-child {
  border-bottom: none;
}
.popup-key {
  font-size: 10px;
  color: #888;
}
.popup-val {
  font-size: 8px;
  color: #fff;
}
.popup-badge {
  text-transform: capitalize;
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
}
.popup-badge.read {
  border: 1.5px solid #4ade80;
  color: #4ade80;
}
.popup-badge.write {
  border: 1.5px solid #8f4ade;
  color: #8f4ade;
}
.popup-badge.read_write {
  border: 1.5px solid #2dd4bf;
  color: #2dd4bf;
}
.popup-badge:is(.atomic, .prefetch, .modify) {
  border: 1.5px solid #3b82f6;
  color: #3b82f6;
}
</style>