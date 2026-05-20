# Mix 子任务分割功能设计文档

## 1. 需求概述

部分 event 可能需要分割成新的 subevent，这些 subevent 独立于原先的 event，只会在 subevent 间存在依赖关系。

### 设计决策

| 决策项 | 选择 |
|--------|------|
| subevent 数据结构 | 复用 EventDetail，通过 parentEventId 关联父事件 |
| 原事件处理方式 | 保留原 event，通过 subEventIds 关联 subevents |
| 依赖关系表示 | 复用 dependencies 字段（predecessors/successors） |
| 嵌套支持 | 仅支持一层分割 |
| ID 生成规则 | 基于父 ID 生成，格式: `{parentId}-sub-{index}` |
| 分割时机 | 运行时动态分割 |

## 2. 数据结构

### 2.1 EventDetail 接口扩展

```typescript
export interface EventDetail {
  // ... 现有字段保持不变
  
  // 新增分割相关字段
  subEventIds?: string[];      // 父事件持有的 subevent ID 列表
  parentEventId?: string;      // subevent 持有的父事件 ID
}
```

### 2.2 MixConfig 接口调整

```typescript
export interface MixConfig {
  wrapId: number;             // 包装 ID（保留原有属性）
  parentEventId: string;       // 父事件 ID（新增）
  subEvents: EventDetail[];     // 分割出的 subevents 列表
}
```

### 2.3 数据流向示意

```
原 Event
└── subEventIds: ["event-A-sub-1", "event-A-sub-2", "event-A-sub-3"]

SubEvents (独立事件)
├── event-A-sub-1: { parentEventId: "event-A", dependencies: { predecessors: [], successors: ["event-A-sub-2"] }}
├── event-A-sub-2: { parentEventId: "event-A", dependencies: { predecessors: ["event-A-sub-1"], successors: ["event-A-sub-3"] }}
└── event-A-sub-3: { parentEventId: "event-A", dependencies: { predecessors: ["event-A-sub-2"], successors: [] }}

mixConfig 存储
└── { parentEventId: "event-A", subEvents: [event-A-sub-1, event-A-sub-2, event-A-sub-3] }
```

## 3. SwimDataManager 新增方法

### 3.1 方法列表

| 方法 | 功能 | 实现状态 |
|------|------|----------|
| `getSubEvents(parentEventId)` | 获取某 event 的所有 subevents | ✅ 已实现 |
| `getSplitConfig(parentEventId)` | 获取分割配置 | ✅ 已实现 |
| `getSubEventDependencies(subEventId)` | 获取 subevent 的依赖关系 | ✅ 已实现 |

### 3.2 方法签名

```typescript
// 获取子事件列表
public getSubEvents(parentEventId: string): EventDetail[];

// 获取分割配置
public getSplitConfig(parentEventId: string): MixConfig | undefined;

// 获取子事件依赖
public getSubEventDependencies(subEventId: string): {
  predecessors: EventDetail[];
  successors: EventDetail[];
};
```

## 4. 修改记录

### 4.1 文件修改

**文件**: `swimData.ts`

#### 接口修改

1. **EventDetail 接口** (第16-41行)
   - 新增 `subEventIds?: string[]`
   - 新增 `parentEventId?: string`

2. **MixConfig 接口** (第43-47行)
   - 保留 `wrapId: number`
   - 新增 `parentEventId: string`

#### 类修改

3. **构造函数** (第55-59行)
   - 新增 `this.mixConfig = []` 初始化
   - 新增 `this.eventsByWrapId = new Map()` 初始化

4. **新增方法** (第185-256行)
   - `splitAllEvents()` - 完整实现
   - `splitSingleEvent()` - 完整实现（私有）
   - `generateAllDependencies()` - 完整实现（私有）
   - `getSubEvents()` - 完整实现
   - `getSplitConfig()` - 完整实现
   - `getSubEventDependencies()` - 完整实现
   - `getSubEventsByWrapId()` - 完整实现
   - `getAllSubEvents()` - 完整实现

### 4.2 Bug 修复与优化

- 修复 `mixConfig` 未初始化问题
- 新增 `eventsByWrapId` 缓存优化性能

## 5. 切分规则

### 5.1 切分条件

| 条件 | 处理方式 |
|------|----------|
| wrapId 无效（-1 或不存在） | 不切分，保留原 event |
| wrapId 有效 + syncEvents 为空 | 添加一个 subevent（startTime → endTime） |
| wrapId 有效 + syncEvents 非空 | 按 syncEvents 切分 |

### 5.2 切分逻辑

1. **syncEvents 结构**
   ```typescript
   syncEvents: [
     { idx: number, time: number, type: "CV_SYNC_SET" | "CV_SYNC_WAIT", eventid: number }
   ]
   ```

2. **syncEvents 参数验证**
   - 必需字段：`eventid`（number）、`time`（number）、`type`（CV_SYNC_SET 或 CV_SYNC_WAIT）
   - 参数不全的 syncEvent：丢弃，不参与切分和依赖生成
   - 找不到配对（SET 找不到 WAIT，或 WAIT 找不到 SET）：丢弃该 syncEvent

3. **配对规则**
   - 每个 syncEvent 的配对（SET ↔ WAIT）一定在另一个 event
   - 通过 `(wrapId, eventid)` 找到配对的另一方

4. **切分点处理**
   - SET：正常作为切分边界
   - WAIT：检查配对 SET.time
     - SET.time ≤ WAIT.time：正常切分
     - SET.time > WAIT.time：丢弃区间处理
     - 找不到配对 SET：正常切分（不触发丢弃规则）

5. **丢弃规则**
   - 当 WAIT 在 SET 之前（WAIT.time < SET.time）
   - 丢弃区间：WAIT.time 到 min(SET.time, event.endTime)
   - 上一个 subevent 在 WAIT.time 结束，下一个 subevent 从 min(SET.time, event.endTime) 开始

6. **时间划分**
   - 第一个 subevent.startTime = event.startTime
   - 最后一个 subevent.endTime = event.endTime
   - 中间按 syncEvents.time 排序切分

7. **命名规则**
   - subevent.name = `{parentEvent.name}_{i}`
   - i 从 0 开始，按切分顺序递增

8. **属性继承**
   - pid、tid、threadName 继承父 event
   - parentEventId 指向父 event.id

### 5.3 切分示例

假设 event_A：
- startTime: 0, endTime: 200
- syncEvents: [SET(eventid=0, time=10), WAIT(eventid=2, time=100)]
- 配对：SET(0) ↔ WAIT(0) 在 event_B(time=30), SET(2) ↔ WAIT(2) 在 event_C(time=120)

切分过程：
1. startTime=0, SET.time=10 → subevent_0 [0, 10]
2. SET(0) 配对 WAIT(0) 在 event_B(time=30)，30 > 10，正常切分
3. WAIT(2) time=100, 配对 SET(2) 在 event_C(time=120)，120 > 100 → 丢弃到 120 或 endTime(200)
   - subevent_1 [10, 100]
   - subevent_2 [120, 200]

## 6. 依赖规则

### 6.1 依赖生成逻辑

1. 遍历所有 SET 事件，找配对的 WAIT（wrapId + eventid）
2. 找不到配对 WAIT：跳过该 SET，不生成依赖
3. SET 在 event_A，找 endTime = SET.time 的 subevent_a
4. WAIT 在 event_B，找 endTime = WAIT.time 的 subevent_b
5. 在 event_B 中找 startTime >= SET.time 的第一个 subevent（subevent_c）
6. 添加依赖：
   - subevent_a.successors += subevent_c.id
   - subevent_c.predecessors += subevent_a.id

### 6.2 subevent_c 确定规则

| WAIT 与 SET 时间关系 | subevent_c |
|---------------------|------------|
| WAIT.time ≥ SET.time | subevent_b 之后紧接着的下一个 subevent |
| WAIT.time < SET.time | 丢弃区间后，从 SET.time 开始的 subevent |

### 6.3 依赖方向

- 单向依赖：SET 所在 subevent → WAIT 所在 event 的 subevent_c
- 表示同步语义：SET 完成后，WAIT 所在 event 才能开始执行 subevent_c

## 7. 使用示例

```typescript
const manager = swimDataManager;

manager.initialize(processes);

manager.splitAllEvents();

const allSubEvents = manager.getAllSubEvents();

const subEventsByWrapId = manager.getSubEventsByWrapId(0);

const subEvents = manager.getSubEvents('event_7');

const config = manager.getSplitConfig('event_7');

const deps = manager.getSubEventDependencies('event_7_sub_0');
```

## 8. 方法实现状态

| 方法 | 功能 | 状态 |
|------|------|------|
| `splitAllEvents()` | 对所有 wrapId 有效的事件进行切分 | ✅ 已实现 |
| `generateAllDependencies()` | 生成跨 event 的 subevent 依赖 | ✅ 已实现（私有） |
| `splitSingleEvent()` | 切分单个 event | ✅ 已实现（私有） |
| `isValidSyncEvent()` | 验证 syncEvent 参数完整性 | ✅ 已实现（私有） |
| `filterValidSyncEvents()` | 过滤无效 syncEvent | ✅ 已实现（私有） |
| `getSubEvents(parentEventId)` | 获取子事件列表 | ✅ 已实现 |
| `getSplitConfig(parentEventId)` | 获取分割配置 | ✅ 已实现 |
| `getSubEventDependencies(subEventId)` | 获取 subevent 依赖关系 | ✅ 已实现 |
| `getSubEventsByWrapId(wrapId)` | 获取同 wrapId 的所有 subevents | ✅ 已实现 |
| `getAllSubEvents()` | 获取所有 subevents | ✅ 已实现 |

## 9. 后续工作

- [x] 定义切分标准和算法
- [x] 完善依赖关系生成逻辑
- [x] 实现切分和依赖生成代码
- [ ] 实现 UI 交互层
- [ ] 添加单元测试
- [ ] 验证切分结果与预期是否一致