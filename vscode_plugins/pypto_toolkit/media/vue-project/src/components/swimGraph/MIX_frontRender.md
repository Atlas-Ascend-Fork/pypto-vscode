# Mix 子图模式前端渲染设计文档

## 1. 概述

### 1.1 文档目的
本文档基于已确定的决策点结论，详细说明 Mix 子图模式的前端渲染实现方案。

### 1.2 关键决策总结

| 决策项 | 结论 |
|--------|------|
| Wait 任务判定 | subevent endTime 与下一个 subevent startTime 不连续 |
| Wait 任务数据 | 渲染层临时对象，不存储 |
| Wrap 容器存储 | 独立数据结构存储在 SwimDataManager |
| SubEvent 依赖边界 | 仅同 wrapId 内（本阶段） |
| 泳道排序结构 | 创建 MixLaneInfo，ThreadInfo 不变 |
| 非 mix 模式兼容 | 保留数据但不渲染 |
| SubEvent 颜色 | 普通 sub 继承 parentEvent.color，Wait 灰色，渲染层计算 |
| Wrap 容器标签 | 使用 wrapId（"wrap 0", "wrap 1"） |
| 数据持久化 | 本阶段不持久化 |

## 2. 数据层设计

### 2.1 数据结构定义

#### 2.1.1 MixLaneInfo 接口

```typescript
export interface MixLaneInfo {
  wrapId: number;
  threads: ThreadInfo[];
  label: string;              // "wrap 0", "wrap 1"
  containerHeight: number;    // wrap标签高度 + wrap内泳道总高度
  labelHeight: number;        // wrap标签单独占用的高度
  startY: number;             // 容器起始Y坐标
  threadStartY: number;       // wrap内第一个泳道的Y坐标
}
```

#### 2.1.2 WaitTask 渲染对象

```typescript
export interface WaitTaskRenderInfo {
  parentEventId: string;
  startTime: number;
  endTime: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
  color: string;              // 灰色
  text: 'Wait';
}
```

### 2.2 SwimDataManager 新增方法

```typescript
class SwimDataManager {
  private wrapLaneInfoMap: Map<number, MixLaneInfo>;
  
  public getWrapLaneInfo(wrapId: number): MixLaneInfo | undefined;
  
  public getAllWrapLaneInfos(): MixLaneInfo[];
  
  public calculateWrapLaneInfos(processes: Map<string, ProcessInfo>, layout: any): void;
  
  public getMixLaneOrder(): (MixLaneInfo | ThreadInfo)[];
}
```

### 2.3 泳道排序算法

```typescript
public calculateWrapLaneInfos(processes: Map<string, ProcessInfo>, layout: any): void {
  this.wrapLaneInfoMap.clear();
  
  const wrapGroups = new Map<number, ThreadInfo[]>();
  
  for (const [processKey, process] of processes.entries()) {
    for (const [threadKey, thread] of process.threads.entries()) {
      const wrapId = this.getWrapIdByThread(thread);
      if (wrapId !== undefined && wrapId !== -1) {
        if (!wrapGroups.has(wrapId)) {
          wrapGroups.set(wrapId, []);
        }
        wrapGroups.get(wrapId)?.push(thread);
      }
    }
  }
  
  for (const [wrapId, threads] of wrapGroups.entries()) {
    const sortedThreads = this.sortThreadsInWrap(threads);
    const labelHeight = layout.threadHeight;
    const threadsHeight = sortedThreads.reduce((sum, thread) => {
      return sum + this.getThreadHeight(thread, layout);
    }, 0);
    
    this.wrapLaneInfoMap.set(wrapId, {
      wrapId,
      threads: sortedThreads,
      label: `wrap ${wrapId}`,
      containerHeight: labelHeight + threadsHeight,
      labelHeight,
      startY: 0,
      threadStartY: 0
    });
  }
}

private sortThreadsInWrap(threads: ThreadInfo[]): ThreadInfo[] {
  const computeThreads = threads.filter(t => this.isComputeThread(t));
  const vectorThreads = threads.filter(t => this.isVectorThread(t));
  
  vectorThreads.sort((a, b) => Number(a.tid) - Number(b.tid));
  computeThreads.sort((a, b) => Number(a.tid) - Number(b.tid));
  
  if (vectorThreads.length === 1 && computeThreads.length === 1) {
    return [vectorThreads[0], computeThreads[0]];
  } else if (vectorThreads.length === 2 && computeThreads.length === 1) {
    return [vectorThreads[0], computeThreads[0], vectorThreads[1]];
  }
  
  return [...vectorThreads, ...computeThreads];
}

public getMixLaneOrder(): (MixLaneInfo | ThreadInfo)[] {
  const mixLanes: (MixLaneInfo | ThreadInfo)[] = [];
  
  const wrapInfos = Array.from(this.wrapLaneInfoMap.values())
    .sort((a, b) => {
      const cTidA = this.getComputeTid(a);
      const cTidB = this.getComputeTid(b);
      return Number(cTidA) - Number(cTidB);
    });
  
  mixLanes.push(...wrapInfos);
  
  const nonMixThreads = this.getNonMixThreads();
  nonMixThreads.sort((a, b) => Number(a.tid) - Number(b.tid));
  mixLanes.push(...nonMixThreads);
  
  return mixLanes;
}
```

### 2.4 Y 坐标计算

```typescript
public calculateYPositions(layout: any): void {
  let currentY = 0;
  
  const orderedLanes = this.getMixLaneOrder();
  
  for (const lane of orderedLanes) {
    if (lane instanceof MixLaneInfo) {
      lane.startY = currentY;
      lane.threadStartY = currentY + lane.labelHeight;
      currentY += lane.containerHeight;
    } else {
      const thread = lane as ThreadInfo;
      thread.renderInfo = {
        startY: currentY,
        height: this.getThreadHeight(thread, layout)
      };
      currentY += thread.renderInfo.height;
    }
  }
}
```

## 3. 渲染层设计

### 3.1 渲染流程

```
数据准备阶段
├── swimDataManager.initialize()
├── swimDataManager.splitAllEvents()
├── swimDataManager.calculateWrapLaneInfos()
└── swimDataManager.calculateYPositions()

渲染阶段（isMixMode = true）
├── renderMixLanes()
│   ├── renderWrapContainers()
│   ├── renderMixThreadLabels()
│   ├── renderSubEvents()
│   └── renderWaitTasks()
├── renderNonMixThreads()
└── renderMixDependencies()
```

### 3.2 Wrap 容器渲染

#### 3.2.1 Canvas 层级
- 使用 `backgroundCtx` 或新建 `wrapContainerCtx`
- 位于泳道标签和事件层之间

#### 3.2.2 渲染实现

```typescript
const renderWrapContainers = (ctx: CanvasRenderingContext2D) => {
  const wrapInfos = swimDataManager.getAllWrapLaneInfos();
  
  for (const wrapInfo of wrapInfos) {
    const startX = 0;
    const startY = wrapInfo.startY;
    const containerWidth = layout.processLabelWidth + viewState.canvasCssWidth;
    const containerHeight = wrapInfo.containerHeight;
    
    ctx.save();
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(150, 150, 150, 0.1)';
    
    ctx.beginPath();
    ctx.roundRect(startX, startY, containerWidth, containerHeight, 8);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#666666';
    ctx.font = '12px Arial';
    ctx.fillText(wrapInfo.label, startX + 10, startY + 15);
    
    ctx.restore();
  }
};
```

### 3.3 Mix 模式渲染规则

**关键规则**：Mix 模式下，父 task（有 `subEventIds` 的 event）不渲染，只渲染 SubEvent。

```typescript
// Mix 模式下的事件过滤逻辑
const getEventsToRenderInMixMode = (thread: ThreadInfo): EventDetail[] => {
  const allEvents = thread.eventIds.map(id => swimDataManager.getEventById(id));
  
  // 过滤掉有 subEventIds 的父事件
  return allEvents.filter(event => {
    // 如果是 Mix 父事件，不渲染
    if (event.subEventIds && event.subEventIds.length > 0) {
      return false;
    }
    // 非 Mix 任务正常渲染
    return true;
  });
};
```

**渲染分类**：
- **Mix 父事件**：不渲染（有 `subEventIds`）
- **SubEvent**：渲染，继承父任务颜色
- **Wait 任务**：渲染，灰色（SubEvent 间隙）
- **非 Mix 任务**：正常渲染（无 `wrapId` 或 `wrapId = -1`）

### 3.4 SubEvent 渲染

#### 3.4.1 渲染逻辑

```typescript
const renderSubEvents = (ctx: CanvasRenderingContext2D, wrapInfo: MixLaneInfo) => {
  for (const thread of wrapInfo.threads) {
    const events = thread.eventIds
      .map(id => swimDataManager.getEventById(id))
      .filter(e => e && e.subEventIds);
    
    for (const parentEvent of events) {
      const subEvents = swimDataManager.getSubEvents(parentEvent.id);
      const color = getEventColor(parentEvent);
      
      for (const subEvent of subEvents) {
        const renderInfo = calculateSubEventRenderInfo(subEvent, thread, wrapInfo);
        renderEventRect(ctx, renderInfo, color, subEvent.name);
      }
      
      renderWaitTasksBetween(ctx, parentEvent.id, thread, wrapInfo);
    }
  }
};
```

#### 3.3.2 坐标计算

```typescript
const calculateSubEventRenderInfo = (
  subEvent: EventDetail,
  thread: ThreadInfo,
  wrapInfo: MixLaneInfo
) => {
  const startX = timeToX(subEvent.startTime);
  const endX = timeToX(subEvent.endTime);
  const startY = wrapInfo.threadStartY + getThreadOffsetInWrap(thread, wrapInfo);
  const width = endX - startX;
  const height = layout.eventHeight;
  
  return { startX, startY, width, height };
};

const getThreadOffsetInWrap = (thread: ThreadInfo, wrapInfo: MixLaneInfo): number => {
  let offset = 0;
  for (const t of wrapInfo.threads) {
    if (t.tid === thread.tid) {
      break;
    }
    offset += getThreadHeight(t, layout);
  }
  return offset;
};
```

#### 3.3.3 颜色获取

```typescript
const getEventColor = (event: EventDetail): string => {
  if (!event.color) {
    return 'rgba(10, 89, 247, 0.3)';
  }
  return isDarkTheme.value ? event.color.dark?.base : event.color.light?.base;
};

const getSubEventColor = (subEvent: EventDetail): string => {
  if (isWaitTask(subEvent)) {
    return '#999999';
  }
  const parentEvent = swimDataManager.getEventById(subEvent.parentEventId);
  return getEventColor(parentEvent);
};
```

### 3.4 Wait 任务渲染

#### 3.4.1 Wait 任务检测

```typescript
const detectWaitTasks = (parentEventId: string): WaitTaskRenderInfo[] => {
  const subEvents = swimDataManager.getSubEvents(parentEventId);
  const parentEvent = swimDataManager.getEventById(parentEventId);
  const waitTasks: WaitTaskRenderInfo[] = [];
  
  if (subEvents.length < 2) {
    return waitTasks;
  }
  
  const sortedSubEvents = [...subEvents].sort((a, b) => a.startTime - b.startTime);
  
  for (let i = 0; i < sortedSubEvents.length - 1; i++) {
    const currentEnd = sortedSubEvents[i].endTime;
    const nextStart = sortedSubEvents[i + 1].startTime;
    
    if (nextStart > currentEnd) {
      waitTasks.push({
        parentEventId,
        startTime: currentEnd,
        endTime: nextStart,
        startX: 0,
        startY: 0,
        width: 0,
        height: layout.eventHeight,
        color: '#999999',
        text: 'Wait'
      });
    }
  }
  
  return waitTasks;
};
```

#### 3.4.2 Wait 任务渲染

```typescript
const renderWaitTasksBetween = (
  ctx: CanvasRenderingContext2D,
  parentEventId: string,
  thread: ThreadInfo,
  wrapInfo: MixLaneInfo
) => {
  const waitTasks = detectWaitTasks(parentEventId);
  
  for (const waitTask of waitTasks) {
    const startX = timeToX(waitTask.startTime);
    const endX = timeToX(waitTask.endTime);
    const startY = wrapInfo.threadStartY + getThreadOffsetInWrap(thread, wrapInfo);
    const width = endX - startX;
    
    ctx.save();
    ctx.fillStyle = '#999999';
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.roundRect(startX, startY, width, waitTask.height, 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#333333';
    ctx.font = '10px Arial';
    const textWidth = ctx.measureText('Wait').width;
    if (width > textWidth + 4) {
      ctx.fillText('Wait', startX + (width - textWidth) / 2, startY + waitTask.height / 2 + 4);
    }
    
    ctx.restore();
  }
};
```

### 3.5 Mix 依赖线渲染

#### 3.5.1 依赖线数据获取

```typescript
const getMixDependencies = (wrapId: number): DependencyLineInfo[] => {
  const subEvents = swimDataManager.getSubEventsByWrapId(wrapId);
  const lines: DependencyLineInfo[] = [];
  
  for (const subEvent of subEvents) {
    const deps = swimDataManager.getSubEventDependencies(subEvent.id);
    
    for (const successor of deps.successors) {
      lines.push({
        fromEventId: subEvent.id,
        toEventId: successor.id,
        wrapId
      });
    }
  }
  
  return lines;
};
```

#### 3.5.2 贝塞尔虚线渲染

```typescript
const renderMixDependencies = (ctx: CanvasRenderingContext2D, wrapId: number) => {
  const dependencies = getMixDependencies(wrapId);
  
  for (const dep of dependencies) {
    const fromEvent = swimDataManager.getEventById(dep.fromEventId);
    const toEvent = swimDataManager.getEventById(dep.toEventId);
    
    if (!fromEvent || !toEvent) continue;
    
    const fromThread = swimDataManager.getThreadByEvent(dep.fromEventId);
    const toThread = swimDataManager.getThreadByEvent(dep.toEventId);
    
    if (!fromThread || !toThread) continue;
    
    const fromWrapInfo = swimDataManager.getWrapLaneInfo(wrapId);
    const toWrapInfo = swimDataManager.getWrapLaneInfo(wrapId);
    
    if (!fromWrapInfo || !toWrapInfo) continue;
    
    const startX = timeToX(fromEvent.endTime);
    const startY = fromWrapInfo.threadStartY + 
                   getThreadOffsetInWrap(fromThread, fromWrapInfo) + 
                   layout.eventHeight / 2;
    
    const endX = timeToX(toEvent.startTime);
    const endY = toWrapInfo.threadStartY + 
                getThreadOffsetInWrap(toThread, toWrapInfo) + 
                layout.eventHeight / 2;
    
    drawBezierDashedLine(ctx, startX, startY, endX, endY);
  }
};

const drawBezierDashedLine = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number
) => {
  ctx.save();
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  
  const cp1x = startX + (endX - startX) * 0.3;
  const cp1y = startY;
  const cp2x = startX + (endX - startX) * 0.7;
  const cp2y = endY;
  
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
  ctx.stroke();
  
  drawArrowHead(ctx, endX, endY);
  
  ctx.restore();
};

const drawArrowHead = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  const arrowSize = 6;
  const angle = Math.PI / 6;
  
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - arrowSize * Math.cos(angle), y - arrowSize * Math.sin(angle));
  ctx.lineTo(x - arrowSize * Math.cos(angle), y + arrowSize * Math.sin(angle));
  ctx.closePath();
  ctx.fillStyle = '#666666';
  ctx.fill();
};
```

### 3.6 Transform 同步

#### 3.6.1 缩放处理

```typescript
const transformMixView = () => {
  const scale = viewState.scale;
  const offsetX = viewState.offsetX;
  
  for (const [processKey, ctxInfo] of Object.entries(ctxs)) {
    if (ctxInfo.wrapContainerCtx) {
      ctxInfo.wrapContainerCtx.save();
      ctxInfo.wrapContainerCtx.setTransform(
        devicePixelRatio, 0, 0, devicePixelRatio,
        offsetX * devicePixelRatio, 0
      );
    }
    
    if (ctxInfo.mixDependencyCtx) {
      ctxInfo.mixDependencyCtx.save();
      ctxInfo.mixDependencyCtx.setTransform(
        devicePixelRatio * scale, 0, 0, devicePixelRatio,
        offsetX * devicePixelRatio, 0
      );
    }
  }
  
  renderWrapContainers();
  renderSubEvents();
  renderWaitTasks();
  renderMixDependencies();
};
```

#### 3.6.2 时间坐标转换

```typescript
const timeToX = (time: number): number => {
  const relativeTime = time - viewState.minTime;
  const normalizedTime = relativeTime / viewState.timeRange;
  return layout.processLabelWidth + 
         normalizedTime * viewState.canvasCssWidth * viewState.scale + 
         viewState.offsetX;
};
```

## 4. Canvas 层级设计

### 4.1 新增 Canvas 层

```typescript
ctxs[processKey] = {
  eventCtx: ...,
  uiCtx: ...,
  dependencyCtx: ...,
  hoverCtx: ...,
  backgroundCtx: ...,
  lineCanvasCtx: ...,
  selectionCanvasCtx: ...,
  threeColumnCanvasCtx: ...,
  // 新增
  wrapContainerCtx: ...,      // Wrap 容器层
  mixDependencyCtx: ...,      // Mix 依赖线层
};
```

### 4.2 层级顺序

从下到上：
1. backgroundCtx - 背景、网格
2. wrapContainerCtx - Wrap 容器（新增）
3. eventCtx - 事件矩形、Wait 任务
4. mixDependencyCtx - Mix 依赖线（新增）
5. dependencyCtx - 非 mix 依赖线
6. hoverCtx - Hover 效果
7. selectionCanvasCtx - 选择框

## 5. 事件交互

### 5.1 SubEvent 点击

```typescript
const findSubEventAtPosition = (x: number, y: number, wrapId: number): EventDetail | null => {
  const wrapInfo = swimDataManager.getWrapLaneInfo(wrapId);
  if (!wrapInfo) return null;
  
  const time = xToTime(x);
  
  for (const thread of wrapInfo.threads) {
    const threadY = wrapInfo.threadStartY + getThreadOffsetInWrap(thread, wrapInfo);
    const threadHeight = getThreadHeight(thread, layout);
    
    if (y >= threadY && y <= threadY + threadHeight) {
      const subEvents = getSubEventsInThread(thread);
      
      for (const subEvent of subEvents) {
        const startX = timeToX(subEvent.startTime);
        const endX = timeToX(subEvent.endTime);
        
        if (x >= startX && x <= endX) {
          return subEvent;
        }
      }
    }
  }
  
  return null;
};
```

### 5.2 Hover 效果

```typescript
const highlightSubEvent = (ctx: CanvasRenderingContext2D, subEvent: EventDetail) => {
  const parentEvent = swimDataManager.getEventById(subEvent.parentEventId);
  const thread = swimDataManager.getThreadByEvent(subEvent.id);
  const wrapInfo = swimDataManager.getWrapLaneInfo(
    swimDataManager.getWrapIdByEvent(subEvent.id)
  );
  
  if (!parentEvent || !thread || !wrapInfo) return;
  
  const startX = timeToX(subEvent.startTime);
  const endX = timeToX(subEvent.endTime);
  const startY = wrapInfo.threadStartY + getThreadOffsetInWrap(thread, wrapInfo);
  const width = endX - startX;
  
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.roundRect(startX - 1, startY - 1, width + 2, layout.eventHeight + 2, 3);
  ctx.stroke();
  
  ctx.restore();
};
```

## 6. 模式切换

### 6.1 切换逻辑

```typescript
const toggleMixMode = (isMixMode: boolean) => {
  if (isMixMode) {
    swimDataManager.calculateWrapLaneInfos(processes, layout);
    swimDataManager.calculateYPositions(layout);
    resizeMixCanvases();
    renderMixView();
  } else {
    renderNormalView();
  }
};
```

### 6.2 Canvas 尺寸调整

```typescript
const resizeMixCanvases = () => {
  const totalHeight = calculateMixTotalHeight();
  
  for (const processKey of Object.keys(ctxs)) {
    const ctxInfo = ctxs[processKey];
    
    if (ctxInfo.wrapContainerCtx) {
      setupHighDPICanvas(
        ctxInfo.wrapContainerCtx.canvas,
        viewState.canvasCssWidth + layout.processLabelWidth,
        totalHeight
      );
    }
    
    if (ctxInfo.mixDependencyCtx) {
      setupHighDPICanvas(
        ctxInfo.mixDependencyCtx.canvas,
        viewState.canvasCssWidth,
        totalHeight
      );
    }
  }
};

const calculateMixTotalHeight = (): number => {
  const orderedLanes = swimDataManager.getMixLaneOrder();
  let totalHeight = 0;
  
  for (const lane of orderedLanes) {
    if (lane instanceof MixLaneInfo) {
      totalHeight += lane.containerHeight;
    } else {
      totalHeight += getThreadHeight(lane, layout);
    }
  }
  
  return totalHeight;
};
```

## 7. 实现清单（第一阶段：渲染 + Transform）

**假设**：Mix 模式默认打开，暂不实现交互层（点击、Hover、模式切换）

### 7.1 数据层（swimData.ts）
- [ ] 添加 `wrapLaneInfoMap: Map<number, MixLaneInfo>` 字段
- [ ] 添加 `isMixModeActive: boolean` 字段
- [ ] 实现 `setMixMode(isMixMode: boolean)`
- [ ] 实现 `hasMixConfig(): boolean` - 判断数据中是否有 wrapId
- [ ] 实现 `getWrapLaneInfo(wrapId: number)`
- [ ] 实现 `getAllWrapLaneInfos()`
- [ ] 实现 `calculateWrapLaneInfos(processes, layout)`
- [ ] 实现 `sortThreadsInWrap(threads)` - 1C1V/1C2V 排序
- [ ] 实现 `getMixLaneOrder()` - 返回整体泳道顺序
- [ ] 实现 `calculateYPositions(lanes, layout)` - Y坐标计算
- [ ] 实现 `getWrapIdByThread(thread)` - 获取线程所属 wrapId
- [ ] 实现 `getComputeTid(wrapInfo)` - 获取 C 的 tid
- [ ] 实现 `isComputeThread(thread)` - 判断是否为 C 线程
- [ ] 实现 `isVectorThread(thread)` - 判断是否为 V 线程
- [ ] 实现 `getThreadHeight(thread, layout)` - 获取线程高度（使用 lane2line）

### 7.2 Canvas 层级
- [ ] swimGraphThreadEvents.vue 新增 `<canvas class="wrap-container-canvas">`
- [ ] swimGraphThreadEvents.vue 新增 `<canvas class="mix-dependency-canvas">`
- [ ] events.css 新增 `.wrap-container-canvas` 样式
- [ ] events.css 新增 `.mix-dependency-canvas` 样式
- [ ] swimGraphUtils.ts `ctxs` 注册新增 `wrapContainerCtx` 和 `mixDependencyCtx`
- [ ] updateProcessSize() 扩展设置新 canvas 尺寸

### 7.3 Wrap 容器渲染
- [ ] 实现 `renderWrapContainer(ctx, wrapInfo, layout, viewState)`
- [ ] 实现 `renderWrapContainersAll()` - 遍历所有 process 渲染
- [ ] 在 `render()` 中调用 `renderWrapContainersAll()`
- [ ] 在 `transform()` 中调用 `renderWrapContainersAll()`

### 7.4 SubEvent 渲染
- [ ] 实现 `filterMixParentEvents(events)` - 过滤掉有 subEventIds 的父事件（Mix 模式下父 task 不渲染）
- [ ] 实现 `getEventsToRenderInMixMode(thread)` - 返回需要渲染的事件列表（仅 SubEvent + 非 mix 任务）
- [ ] 实现 `renderSubEvents(ctx, wrapInfo, processKey)` - 渲染 wrap 内所有 SubEvent
- [ ] 实现 `calculateThreadYInWrap(thread, wrapInfo)` - 计算线程在 wrap 内的 Y 坐标
- [ ] 实现 `getSubEventColor(subEvent)` - 继承父任务颜色
- [ ] 实现 `renderSubEventsAll()` - 遍历所有 wrap 渲染
- [ ] 实现 `renderMixMode(process, processKey)` - Mix 模式渲染入口
- [ ] 在 `render()` 中调用 Mix 模式渲染
- [ ] 在 `transform()` 中调用 Mix 模式渲染

### 7.5 Wait 任务渲染
- [ ] 实现 `detectWaitTasks(parentEventId)` - 检测时间间隙
- [ ] 实现 `renderWaitTasksBetween(ctx, parentEventId, threadY)` - 渲染 Wait 灰色矩形
- [ ] 在 `renderSubEvents()` 中调用 Wait 任务渲染

### 7.6 Mix 依赖线渲染
- [ ] 实现 `getMixDependencies(wrapId)` - 获取依赖数据
- [ ] 实现 `renderMixDependencies(ctx, wrapInfo)` - 渲染贝塞尔虚线
- [ ] 实现 `drawBezierDashedLine(ctx, startX, startY, endX, endY)` - 贝塞尔虚线绘制
- [ ] 实现 `drawArrowHead(ctx, x, y)` - 箭头绘制
- [ ] 实现 `renderMixDependenciesAll()` - 遍历所有 wrap 渲染
- [ ] 在 `render()` 中调用 `renderMixDependenciesAll()`
- [ ] 在 `transform()` 中调用 `renderMixDependenciesAll()`
- [ ] 实现 `clearMixDependencyCanvas(processKey)` - 清空画布

### 7.7 模式初始化
- [ ] swimGraphComplete.vue 新增 `isMixMode` 状态（区别于 `isMixedAicpuKernel`)
- [ ] `loadTraceData()` 中判断 `hasMixConfig()` 并预计算数据
- [ ] `initCanvases()` 扩展初始化 Mix 相关 canvas
- [ ] `resizeCanvases()` 扩展计算 Mix 模式总高度
- [ ] `render()` 和 `transform()` 中根据 `isMixMode` 分支渲染

### 7.8 交互层（第二阶段，暂不实现）
- [ ] `findSubEventAtPosition()` - 点击查找 SubEvent
- [ ] `selectSubEvent()` - SubEvent 选中逻辑
- [ ] `highlightSubEventHover()` - Hover 高亮
- [ ] Mix 模式切换按钮
- [ ] SubEvent 详情面板
- [ ] 模式状态持久化

## 8. 文件改动清单

| 文件 | 改动内容 |
|------|----------|
| swimData.ts | 新增 MixLaneInfo 数据结构、泳道排序算法、Y坐标计算等方法（约 15 个新增方法） |
| swimGraphThreadEvents.vue | 新增 2 个 canvas DOM、渲染逻辑、transform 逻辑（约 200-300 行新增） |
| swimGraphUtils.ts | 新增 ctxs 字段注册、renderWrapContainer 等辅助函数（约 50 行新增） |
| swimGraphComplete.vue | 新增 isMixMode 状态、render/transform 分支逻辑（约 50 行新增） |
| events.css | 新增 2 个 canvas 样式（约 10 行新增） |

## 9. 实现顺序建议

**推荐按以下顺序实现**（降低风险，逐步验证）：

1. **Step 1**: 数据层核心方法（泳道排序、Y坐标计算）
2. **Step 2**: Canvas 层级搭建（新增 DOM 和样式）
3. **Step 3**: Wrap 容器渲染（最简单，优先验证架构）
4. **Step 4**: SubEvent 渲染（复用 EventRender）
5. **Step 5**: Wait 任务渲染（间隙检测）
6. **Step 6**: Mix 依赖线渲染（贝塞尔虚线）
7. **Step 7**: Transform 同步（缩放和移动）
8. **Step 8**: 集成到 render() 和 transform()
9. **Step 9**: 交互层（第二阶段）

## 8. 测试要点

### 8.1 功能测试
- Wrap 容器正确渲染位置和尺寸
- SubEvent 正确继承父任务颜色
- Wait 任务正确显示在时间间隙处
- 贝塞尔虚线正确连接依赖 SubEvent
- Transform 缩放和移动同步正确

### 8.2 性能测试
- 大量 SubEvent 渲染性能
- Wrap 容器数量对性能影响
- 模式切换响应时间

### 8.3 边界测试
- 空 wrapId 处理
- 单个 SubEvent 处理
- 无时间间隙（无 Wait 任务）
- 跨 wrap 边界处理

## 9. 相关文档

- 数据层设计文档：`MIX_DESIGN.md`
- 需求决策文档：`MIX_FRONTEND.md`
- 数据层实现代码：`swimData.ts`
- 渲染层实现代码：`swimGraphProcesses/` 目录