# 通用芯片内存可视化配置指南

本指南说明如何通过 JSON 配置（而非硬编码的 Vue 组件逻辑）来描述特定芯片的内存布局。目标是使内存可视化能在不同芯片架构间复用，同时保持运行时内存 trace 文件不变。

当前内置预设为 `DAV_2201` / Ascend 910B。后续如需支持其他架构，可创建新的芯片配置 JSON 并在前端 loader 中注册。

## 适用范围

本指南覆盖计算图内存可视化面板所使用的芯片布局。描述内容包括：静态芯片配置 schema、运行时内存 trace 数据到可视化节点的映射方式、传输边动画的匹配方式，以及如何安全地新增内置芯片预设。

本指南不描述 GM 内存使用图表。该视图使用独立的基于 region 的数据模型，与右侧芯片内存分配视图的文档分开维护。

## 设计目标与非目标

通用芯片配置特性将静态可视化拓扑与运行时 trace 状态分离。这样可以让芯片特定的布局工作收口在 JSON 预设中，让 Vue 渲染代码专注于渲染本身。

目标：

| 目标 | 原因 |
| --- | --- |
| 保留 910B 行为作为默认基线 | 当 `metadata.chipArch` 缺失或为 `DAV_2201` 时，既有用户应看到相同的布局。 |
| 从 `metadata.chipArch` 选择内置预设 | trace 选择芯片布局时无需修改 trace 事件 schema。 |
| 保持运行时 trace JSON 不变 | 分配、释放、spill、launch、retire 和失败事件仍属于后端拥有的运行时数据。 |
| 将静态拓扑移入配置 | 标签、内存块、容量、坐标、handle 和边可能因芯片不同而变化。 |
| 保持样式语义化 | 配置使用 `styleToken` 值；主题变量和组件细节仍由前端拥有。 |
| 保持 v1 动画兼容性最小 | 当前基于 path 的动画规则仍局部保留在 `memoryGraphAdapter.ts` 中。 |

当前版本的非目标：

| 非目标 | 说明 |
| --- | --- |
| 运行时加载用户提供的配置 | 预设在构建时内置。 |
| 内存 trace schema 重设计 | 现有 trace 事件字段仍是动态状态的来源。 |
| 计算图 schema 重设计 | 芯片布局选择独立于图 schema 变更。 |
| 后端解析重写 | 前端消费相同的 metadata 和事件 payload。 |
| 自动图布局生成 | 坐标在配置中显式指定。 |
| 完整的动画规则 DSL | `animation.pipeTypes` 仅记录意图；激活仍基于 path。 |

## 相关文件

| 文件 | 用途 |
| --- | --- |
| `media/vue-project/src/config/chip-config-910b.json` | `DAV_2201` 的内置默认芯片内存布局。 |
| `media/vue-project/src/config/chip-config-ascend910-95-sample.json` | `DAV_3510` / Ascend910_95 demo trace 的内置示例芯片内存布局。 |
| `media/vue-project/src/config/chip-config-loader.ts` | 根据 `metadata.chipArch` 选择内置芯片配置。 |
| `media/vue-project/src/config/chip-config.types.ts` | 芯片配置字段的 TypeScript schema。 |
| `media/vue-project/src/config/chip-config-validator.ts` | 对节点 id、handle、边、样式和容量进行运行时校验。 |
| `media/vue-project/src/config/chip-style-resolver.ts` | 将语义样式 token 映射到既有的 Vue 节点和边样式。 |
| `media/vue-project/src/components/comGraph/memoryGraphAdapter.ts` | 将芯片配置加运行时 buffer 组合为 Vue Flow 节点和边。 |
| `media/vue-project/src/components/comGraph/comGraphMemory.vue` | 渲染生成的 Vue Flow 图。不应包含芯片特定拓扑。 |
| `media/vue-project/src/components/comGraph/memoryAllocation.vue` | 选择配置，接收 timeline 数据，并将图数据传递给渲染器。 |

## 端到端流程

运行时内存 trace 仍是动态状态的来源。芯片配置仅描述静态拓扑和可视化映射。

```text
memory trace metadata.chipArch
  -> chip-config-loader.ts selects a bundled ChipConfig
  -> memoryAllocation.vue converts buffer snapshots into graphData
  -> memoryGraphAdapter.ts combines ChipConfig + graphData + selected event
  -> comGraphMemory.vue renders Vue Flow nodes and edges
```

对于默认内置芯片，`metadata.chipArch: "DAV_2201"` 选择 `chip-config-910b.json`。内置示例 `metadata.chipArch: "DAV_3510"` 选择 `chip-config-ascend910-95-sample.json`。如果 `metadata.chipArch` 缺失或不支持，loader 会回退到默认的 `DAV_2201` 配置并记录一条警告日志。

## 运行时数据 vs 静态配置

内存 trace 提供动态状态：

| 运行时字段 | 含义 |
| --- | --- |
| `metadata.chipArch` | 用于选择内置配置的架构 key。 |
| `timeline[]` | 有序的内存和算子事件。 |
| `eventType` | 事件类别，如分配、释放、算子 launch、算子 retire 或分配失败。 |
| `clock` 和 `cycleEnd` | 用于事件列表分组和动画时长的时间信息。 |
| `memId` | 运行时 buffer id。传输动画使用 `inputMemIds` 和 `outputMemIds` 查找源和目标 buffer。 |
| `memType` | 运行时内存类型，如 `MEM_GM`、`MEM_L2`、`MEM_L1`、`MEM_L0A`、`MEM_L0B`、`MEM_L0C` 或 `MEM_UB`。 |
| `addrStart` 和 `size` | 运行时内存占用。adapter 将字节转换为可视化格子区间。 |
| `status` | 用于层级颜色的 buffer 状态。当前 adapter 期望取值为 `0`、`1` 或 `2`。 |
| `inputMemIds` 和 `outputMemIds` | 算子传输端点，用于激活配置好的边路径。 |
| `errorMemType` | 在分配失败时高亮的内存类型。 |

芯片配置提供静态渲染信息：

| 配置字段 | 含义 |
| --- | --- |
| `chip` | 身份和展示元数据。 |
| `legend` | 在内存面板头部展示的格子形状和单位标签。 |
| `memoryTypeMap` | 运行时 `memType` 到可视化节点 id 的映射。 |
| `memoryCapacityBytes` | 每个运行时内存类型的容量。 |
| `nodes` | 静态可视化块，如 GM、L2、L1、L0、UB、cache、compute 和容器。 |
| `edges` | 静态传输拓扑和动画 path key。 |
| `styleToken` 字段 | 由 `chip-style-resolver.ts` 解析的语义样式引用。 |

## 配置选择

配置选择发生在 `selectChipConfig` 中。

```typescript
const requestedArch = chipArch || DEFAULT_CHIP_ARCH;
const selectedConfig = bundledChipConfigs[requestedArch];
const config = selectedConfig || defaultChipConfig;
```

当前行为：

| 情形 | 结果 |
| --- | --- |
| trace 含 `metadata.chipArch: "DAV_2201"` | 使用内置 910B 配置。 |
| trace 含 `metadata.chipArch: "DAV_3510"` | 使用内置 Ascend910_95 示例配置。 |
| trace 无 `metadata.chipArch` | 使用内置 910B 配置。 |
| trace 含不支持的 `metadata.chipArch` | 使用内置 910B 配置并记录警告。 |
| 选中的配置无效 | 尽可能回退到 910B 并记录校验详情。 |

当新芯片准备内置时，在 `chip-config-loader.ts` 中添加其 JSON import 和架构映射。

```typescript
import * as chipConfigNewArch from './chip-config-new-arch.json';

const bundledChipConfigs: Record<string, ChipConfig> = {
  DAV_2201: chipConfig910b as ChipConfig,
  DAV_XXXX: chipConfigNewArch as ChipConfig,
};
```

## 顶层 Schema

| 字段 | 是否必需 | 描述 |
| --- | --- | --- |
| `schemaVersion` | 是 | 配置 schema 版本。当前 validator 接受 `"1.0"`。 |
| `chip.model` | 否 | 硬件或产品型号名，用于文档和诊断。 |
| `chip.arch` | 是 | 期望从 `metadata.chipArch` 获取的架构 key，例如 `DAV_2201`。 |
| `chip.displayName` | 是 | 在内存面板头部展示给用户的芯片标签。 |
| `chip.description` | 否 | 该预设的简短描述。 |
| `canvas.width` | 否 | 绝对坐标的参考宽度。当前仅作信息用途。 |
| `canvas.height` | 否 | 绝对坐标的参考高度。当前仅作信息用途。 |
| `canvas.coordinateSystem` | 否 | 坐标系描述。当前内置配置使用 `absolute`。 |
| `legend[]` | 是 | 用于可视化内存格子单位的头部图例条目。 |
| `memoryTypeMap` | 是 | 将运行时内存名映射到可视化节点 id 或拆分子节点 id。 |
| `memoryCapacityBytes` | 是 | 每个运行时内存类型的容量，单位为字节。 |
| `nodes[]` | 是 | 静态可视化拓扑。 |
| `edges[]` | 是 | 静态传输拓扑。 |
| `fallbacks` | 否 | 预留元数据，用于未来的回退行为。 |

顶层最小示例：

```json
{
  "schemaVersion": "1.0",
  "chip": {
    "model": "Ascend910B",
    "arch": "DAV_2201",
    "displayName": "910B"
  },
  "legend": [],
  "memoryTypeMap": {},
  "memoryCapacityBytes": {},
  "nodes": [],
  "edges": []
}
```

## 图例条目

图例显示在 `memoryAllocation.vue` 中图的上方。它说明每个渲染格子代表多少 KB。

| 字段 | 是否必需 | 描述 |
| --- | --- | --- |
| `shape` | 是 | 格子形状：通常为 `square`、`circle` 或 `hexagon`。 |
| `label` | 是 | 展示给用户的文本，例如 `1KB (1024B)`。 |
| `unitKB` | 是 | 一个可视化格子所代表的 KB 数。 |
| `styleToken` | 是 | 语义图例样式 token。当前已知 token 为 `legend.square`、`legend.circle` 和 `legend.hexagon`。 |

格子单位必须与使用相同形状的节点网格匹配。例如，内置 910B 配置对 GM 六边形使用 `unitKB: 8192`，对 L2 圆形使用 `unitKB: 128`，对方形本地内存使用 `unitKB: 1`。

## 内存类型映射

`memoryTypeMap` 是实现芯片通用化最关键的部分。它将 trace 中的运行时内存名连接到静态可视化节点。

内置 910B 配置示例：

```json
"memoryTypeMap": {
  "MEM_GM": "gm",
  "MEM_DEVICE_DDR": "gm",
  "MEM_L2": "gm.l2",
  "MEM_L1": "aic-l1",
  "MEM_L0A": "aic-l0a",
  "MEM_L0B": "aic-l0b",
  "MEM_BT": "aic-bt",
  "MEM_FP": "aic-fp",
  "MEM_L0C": "aic-l0c",
  "MEM_UB": "aiv2b-ub"
}
```

映射规则：

| 规则 | 说明 |
| --- | --- |
| key 为运行时 `memType` | key 必须在后端归一化后与 trace 值精确匹配。 |
| value 为可视化节点 id | value 必须匹配某个 `nodes[].id` 或某个 `splitChildren[].id`。 |
| 多个运行时类型可映射到同一可视化节点 | adapter 将映射到同一目标的所有内存类型分组。用于 GM 别名（如 `MEM_GM` 和 `MEM_DEVICE_DDR`）。 |
| 拆分子节点 id 是合法目标 | `MEM_L2` 映射到 `gm.l2`，后者渲染在 GM 节点内部。 |
| 缺失映射意味着运行时显示缺失 | 如果某个运行时内存类型未被映射，该类型的 buffer 无法应用到可视化块。 |

分组行为由 `memoryGraphAdapter.ts` 中的 `getRelatedMemTypes` 实现。如果 `MEM_GM` 和 `MEM_DEVICE_DDR` 都映射到 `gm`，渲染 `gm` 节点时会合并两个 key 的运行时 buffer。

## 内存容量映射

`memoryCapacityBytes` 记录每个运行时内存类型的物理或逻辑容量。

```json
"memoryCapacityBytes": {
  "MEM_GM": 4294967296,
  "MEM_L2": 33554432,
  "MEM_L1": 524288,
  "MEM_L0A": 69632,
  "MEM_L0B": 69632,
  "MEM_L0C": 262144,
  "MEM_UB": 253952
}
```

重要细节：

| 细节 | 说明 |
| --- | --- |
| 单位为字节 | 不要在此存储 KB 或 MB。adapter 在需要时将字节转换为 KB。 |
| key 与 `memoryTypeMap` 对齐 | 每个可能出现在 trace 数据中的运行时内存类型都应同时拥有映射条目和容量条目。 |
| 容量用于图数据初始化 | `buildGraphDataFromBuffers` 会根据 `memoryCapacityBytes` 和 `memoryTypeMap` 为每个已知内存类型创建条目。 |
| 容量本身不定义网格大小 | 可见网格由 `nodes[].grid.rows`、`nodes[].grid.cols` 和 `nodes[].grid.unitKB` 控制。 |

可见网格通常应足够大，以便在将字节转换为节点格子单位后能表示配置的容量。例如，`253952` 字节的 UB 为 `248KB`；若 `unitKB: 1` 的方形网格需要展示满容量，则至少需要 `248` 个格子。

## 节点 Schema

节点定义静态拓扑。它们通过 `buildFlowNode` 转换为 Vue Flow 节点。

| 字段 | 是否必需 | 描述 |
| --- | --- | --- |
| `id` | 是 | 唯一的可视化节点 id。被 `memoryTypeMap`、`parentId` 和边引用。 |
| `kind` | 是 | 语义类型，如 `memory`、`container`、`compute`、`cache` 或 `hidden`。 |
| `component` | 是 | Vue Flow 节点组件。常见值为 `gridNode` 和 `vectorNode`。 |
| `label` | 是 | 在节点中渲染的文本。 |
| `memType` | 否 | 该节点表示的运行时内存类型。普通节点若需要运行时占用则必填。 |
| `parentId` | 否 | 容器节点 id。子节点位置相对于父节点。 |
| `position.x` 和 `position.y` | 否 | 节点位置。缺省为 `{ x: 0, y: 0 }`。 |
| `size.width` 和 `size.height` | 否 | vector/container/compute 节点的尺寸。 |
| `grid.rows` | 网格内存必填 | 网格行数。 |
| `grid.cols` | 网格内存必填 | 网格列数。 |
| `grid.shape` | 网格内存必填 | 格子形状：`square`、`circle`、`hexagon` 或组件支持的自定义值。 |
| `grid.unitKB` | 网格内存必填 | 一个格子代表的 KB 数。用于 `filledCount`、层级和动画速度。 |
| `styleToken` | 否 | 语义样式 token。缺省为 `memory.l1`。 |
| `showHeader` | 否 | 覆盖是否显示节点头部。 |
| `showStats` | 否 | 在支持的网格节点上启用内存使用统计展示。 |
| `splitType` | 否 | `splitChildren` 的布局方向，如 `horizontal`。 |
| `visibility` | 否 | `hidden` 用于创建无可见 UI 的路由/锚点节点。 |
| `handles[]` | 否 | 边连接锚点。当边引用 handle id 时必填。 |
| `splitChildren[]` | 否 | 渲染在同一可视化节点内的内存块。用于 GM 内含 L2 的场景。 |
| `initialFilledCount` | 否 | 应用运行时状态之前的静态填充。图数据可用后由运行时 trace 数据覆盖。 |
| `data` | 否 | 少量组件特定的视觉覆盖。谨慎使用；优先使用 schema 字段和样式 token。 |

### 内存节点示例

```json
{
  "id": "aic-l1",
  "kind": "memory",
  "component": "gridNode",
  "label": "L1",
  "memType": "MEM_L1",
  "parentId": "aic",
  "position": { "x": 180, "y": 70 },
  "grid": {
    "rows": 32,
    "cols": 16,
    "shape": "square",
    "unitKB": 1
  },
  "styleToken": "memory.l1",
  "showHeader": true,
  "showStats": true
}
```

### 容器节点示例

```json
{
  "id": "aic",
  "kind": "container",
  "component": "vectorNode",
  "label": "AIC",
  "position": { "x": -30, "y": 0 },
  "size": { "width": 1570, "height": 645 },
  "styleToken": "container.core"
}
```

### 拆分子节点示例

内置 910B 图将 L2 渲染在 GM 内部。这样避免了在顶层单独创建 L2 节点，同时仍允许运行时 `MEM_L2` 数据独立映射。

```json
{
  "id": "gm",
  "kind": "memory",
  "component": "gridNode",
  "label": "GM",
  "memType": "MEM_GM",
  "splitType": "horizontal",
  "splitChildren": [
    {
      "id": "gm.l2",
      "kind": "memory",
      "label": "L2",
      "memType": "MEM_L2",
      "grid": {
        "rows": 64,
        "cols": 4,
        "shape": "circle",
        "unitKB": 128
      },
      "styleToken": "memory.l2"
    }
  ]
}
```

## Handle Schema

handle 是可选的连接锚点。当边必须附着到节点某一精确侧或某个百分比位置时非常有用。

| 字段 | 是否必需 | 描述 |
| --- | --- | --- |
| `id` | 是 | 在节点内唯一。边通过此 id 引用。 |
| `type` | 否 | `source` 或 `target`。用于 Vue Flow 语义。 |
| `edge` | 是 | 节点侧：`top`、`bottom`、`left` 或 `right`。 |
| `pct` | 是 | 在该侧上的锚点位置。数字为百分比；字符串值（如 `55px`）由节点组件支持。 |

示例：

```json
{
  "id": "aic-l1-r-25",
  "type": "source",
  "edge": "right",
  "pct": 25
}
```

validator 会校验每条边引用的 `sourceHandle` 和 `targetHandle` 在对应节点上是否存在。

## 边 Schema

边定义静态传输拓扑。它们通过 `buildFlowEdge` 转换为 Vue Flow 边。

| 字段 | 是否必需 | 描述 |
| --- | --- | --- |
| `id` | 是 | 唯一的边 id。 |
| `source` | 是 | 源可视化节点 id。 |
| `target` | 是 | 目标可视化节点 id。 |
| `sourceHandle` | 否 | 源节点上的 handle id。 |
| `targetHandle` | 否 | 目标节点上的 handle id。 |
| `path` | 推荐 | 运行时动画查找 key，例如 `E-MEM_L1-MEM_L0A`。 |
| `label` | 否 | 在边上渲染的标签，例如 `MTE_1`。 |
| `styleToken` | 否 | 语义边样式 token。缺省为 `pipe.compute`。 |
| `dash` | 否 | 启用橙色虚线样式和边动画样式。 |
| `doubleArrow` | 否 | 在支持的边渲染上表示双向关系。 |
| `labelX`, `labelY` | 否 | 手动覆盖标签位置。 |
| `labelWidth`, `labelHeight` | 否 | 手动覆盖标签尺寸。 |
| `borderRadius` | 否 | 标签圆角覆盖。 |
| `markerEnd` | 否 | 箭头标记覆盖。设为 `false` 可抑制默认箭头。 |
| `waypoints` | 否 | 用于自定义边路径渲染的手动路由点。 |
| `animation.enabled` | 否 | 文档标志，表示该边是否应动画。当前激活依据 `path`。 |
| `animation.pipeTypes` | 否 | 与该边关联的 pipe 类型，如 `PIPE_MTE1`。当前 adapter 不按 pipe type 匹配。 |

示例：

```json
{
  "id": "e-l1-l0a",
  "source": "aic-l1",
  "target": "aic-l0a",
  "sourceHandle": "aic-l1-r-25",
  "targetHandle": "aic-l0a-l",
  "path": "E-MEM_L1-MEM_L0A",
  "label": "MTE_1",
  "styleToken": "pipe.mte",
  "animation": {
    "enabled": true,
    "pipeTypes": ["PIPE_MTE1"]
  }
}
```

## 样式 Token

样式 token 保持配置 JSON 的语义性。它们避免在每个节点中重复 CSS 和组件细节。

当前已知的节点样式 token：

| Token | 用途 |
| --- | --- |
| `memory.gm` | GM 网格样式。 |
| `memory.l2` | L2 拆分网格样式。 |
| `memory.l1` | 方形本地内存样式。 |
| `memory.l0` | L0 内存样式。 |
| `memory.ub` | UB 内存样式。 |
| `memory.cache` | DCache/ICache 样式。 |
| `memory.scalar` | Scalar 块样式。 |
| `container.core` | AIC/AIV 容器样式。 |
| `compute.cube` | Cube 计算块样式。 |
| `compute.vector` | Vector 计算块样式。 |
| `pipe.fixpipe` | 隐藏/fixpipe 辅助样式。 |

当前已知的边样式 token：

| Token | 用途 |
| --- | --- |
| `pipe.mte` | 内存传输边。 |
| `pipe.fixpipe` | FixPipe 边。 |
| `pipe.compute` | 计算/数据通路边。 |
| `pipe.cache` | cache 相关边。 |

未知样式 token 会产生校验警告。它们目前不会阻断渲染，但 resolver 会回退到默认样式。

## 运行时占用映射

运行时占用在 `applyMemoryRuntimeToData` 中应用。

对于每个内存可视化节点：

1. adapter 通过 `memoryTypeMap` 查找与该节点关联的所有运行时内存类型。
2. 从 `graphData` 读取当前 buffer 列表。
3. 将 `status` 不为 `0` 的 buffer 大小相加，得到活跃字节数。
4. 使用 `grid.unitKB` 将活跃字节数转换为可视化的 `filledCount`。
5. 将每个 buffer 转换为一个层级区间，含 `startLocation`、`size`、`color` 和 `bufferMsg`。

关键公式：

```text
filledCount = ceil(sum(activeBuffer.size) / 1024 / node.grid.unitKB)
```

层级位置和层级大小使用相同单位：

```text
startLocation = buffer.addrStart / 1024 / node.grid.unitKB
size          = buffer.size      / 1024 / node.grid.unitKB
```

这意味着 `unitKB` 必须谨慎选择。小型本地内存通常使用 `unitKB: 1`，使每个方格代表 1KB。大型 GM 块通常使用大得多的值，以保持图的可读性。

## 运行时动画映射

边动画是通用的，但基于 path。在事件期间，`buildAnimationState` 查看 `inputMemIds` 和 `outputMemIds`，在 `originBufferList` 或 `targetBufferList` 中查找匹配的 buffer，读取它们的 `memType`，并构造传输 path key。

对于从 `MEM_L1` 到 `MEM_L0A` 的传输，活跃 path 为：

```text
E-MEM_L1-MEM_L0A
```

任何带 `path: "E-MEM_L1-MEM_L0A"` 的配置边都会收到动画数据。

特殊情形：

| 情形 | 行为 |
| --- | --- |
| 源或目标运行时类型为 `MEM_GM` | path 匹配将其视为 `MEM_L2`。保留既有 910B 传输行为。 |
| 输出内存为 `MEM_L0C` | adapter 还会激活 `E-<input>-MEM_CUBE` 和 `E-MEM_CUBE-MEM_L0C`，使 Cube 兼容路径可以动画。 |
| 配置边含 `animation.pipeTypes` | 它记录预期的 pipe 语义，但当前激活仍依赖 `edge.path`。 |

DAV_3510 风格 demo trace 示例：

```json
{
  "eventType": "OP_LAUNCH",
  "clock": 220,
  "cycleEnd": 290,
  "pipeType": "PIPE_MTE1",
  "inputMemIds": [101],
  "outputMemIds": [102, 103]
}
```

如果 `memId: 101` 在 `MEM_L1`，`memId: 102` 在 `MEM_L0A`，`memId: 103` 在 `MEM_L0B`，则 adapter 激活：

```text
E-MEM_L1-MEM_L0A
E-MEM_L1-MEM_L0B
```

## 分配失败映射

分配失败使用选中事件动作中的 `errorMemType`。如果失败关联 `MEM_UB`，adapter 通过相同的运行时内存映射将该可视化 UB 节点标记为动画/错误状态。

对于 DAV_3510 风格的 trace，失败事件可能如下：

```json
{
  "eventType": "ALLOC_FAIL",
  "clock": 410,
  "memType": "MEM_UB1",
  "requestSize": 262144,
  "bufferSnapshot": {
    "capacity": 253952,
    "freeIntervals": [{ "start": 65536, "size": 188416 }]
  }
}
```

为了与其他 UB 块独立高亮，芯片配置必须在 `memoryTypeMap` 和 `memoryCapacityBytes` 中包含 `MEM_UB1`，并且 trace 到事件的转换必须在 action payload 中保留 `errorMemType: ["MEM_UB1"]`。

## DAV_3510 Demo 上下文

开发 demo 可能使用如下文件：

| Demo 文件 | 角色 |
| --- | --- |
| `demo_Ascend910_95.json` | 含 demo 算子 magic id 的匹配计算图。 |
| `demo_Ascend910_95_OoO_Memory_Trace.json` | 含 `metadata.chipArch: "DAV_3510"` 的运行时内存 trace。 |
| `chip-config-ascend910-95-sample.json` | 为 `DAV_3510` 选中的内置示例配置。 |

demo trace 很有用，因为它会触发与 910B 基线不同的行为：

| Trace 行为 | 为何对配置设计重要 |
| --- | --- |
| `metadata.chipArch: "DAV_3510"` | 演示基于架构的配置选择。此 key 选中内置 Ascend910_95 示例配置。 |
| 独立的 `MEM_UB0` 和 `MEM_UB1` 事件 | 演示多个 UB 块需要不同的运行时 memType key 和不同的可视化节点 id。 |
| `MEM_L1 -> MEM_L0A` 和 `MEM_L1 -> MEM_L0B` 算子 | 演示一个源内存激活多条传输路径。 |
| `MEM_L0A`/`MEM_L0B` 经由 Cube 到 `MEM_L0C` | 演示当前 Cube/L0C 动画扩展。 |
| 在 `MEM_UB1` 上的 `ALLOC_FAIL` | 演示对特定内存 bank 的独立失败高亮。 |

当前分支在 `chip-config-loader.ts` 中内置了 `DAV_3510`，因此 demo trace 应直接选中示例拓扑。如果该映射在未来的清理中被移除，trace 会安全地回退到默认 910B 配置，但不再展示自定义 DAV_3510 拓扑。

## 新增内置芯片

当芯片 owner 提供新的架构布局时，使用此流程。

在编写 JSON 之前，从芯片或架构 owner 处收集静态可视化契约。维护者不需要完整的芯片设计知识；他们需要足够的稳定拓扑信息，以将运行时内存事件映射到可读的图。

建议请求语：

```text
I need the static memory visualization topology for chip architecture <chipArch>.
Please provide the memory blocks visible to users, their capacities, compute engines/containers, cache blocks, and legal transfer paths between memories/engines.
The output will be mapped into a config JSON with nodes, edges, capacities, and runtime memory-type mappings.
```

需要收集的信息：

| 必需信息 | 配置字段 | 示例 |
| --- | --- | --- |
| trace metadata 中输出的架构 id | `chip.arch` 及 loader 映射 | `DAV_3510` |
| 面向用户的芯片名 | `chip.displayName` | `Ascend910_95 Sample` |
| 用户可见的内存区域 | `nodes[]`（`kind: "memory"`） | `GM`、`L2`、`L1`、`L0A`、`L0B`、`L0C`、`UB0`、`UB1` |
| 每个内存区域的字节容量 | `memoryCapacityBytes` | `"MEM_UB1": 253952` |
| trace 事件输出的运行时 `memType` | `memoryTypeMap` key | `MEM_UB0`、`MEM_UB1` |
| 每个运行时内存类型的可视化目标 | `memoryTypeMap` value | `"MEM_UB1": "aiv1-ub"` |
| 分组区域 | `nodes[]`（`kind: "container"`） | `AIC`、`AIV0`、`AIV1` |
| 计算引擎 | `nodes[]`（`kind: "compute"`） | `Cube`、`Vector`、`Scalar` |
| cache 块 | `nodes[]`（`kind: "cache"`） | `DCache`、`ICache` |
| 合法的数据移动路径 | `edges[]` | `L2 -> L1`、`L1 -> L0A`、`UB -> Vector` |
| pipe 名和运行时 pipe 类型 | 边 `label`、`animation.pipeTypes` | `MTE_1`、`PIPE_MTE1` |
| 视觉一致性 vs 硬件规格精度 | 节点坐标、网格尺寸、标签 | 保留既有 910B 布局或采用芯片 owner 布局 |

1. 在 `media/vue-project/src/config/` 下创建 `chip-config-<arch-or-model>.json`。
2. 将 `schemaVersion` 设为 `"1.0"`。
3. 将 `chip.arch` 设为 trace `metadata.chipArch` 输出的精确值。
4. 在设计网格之前先定义图例格子单位。
5. 在 `memoryTypeMap` 中列出每个运行时内存类型。
6. 在 `memoryCapacityBytes` 中以字节为单位列出每个运行时内存类型容量。
7. 先构建容器节点，如 AIC/AIV 分组。
8. 添加内存节点，含 `memType`、`grid`、`styleToken` 和位置。
9. 添加可读传输路由所需的 compute/cache/helper 节点。
10. 仅在边放置需要精确锚点时添加 handle。
11. 添加边，使用与运行时内存传输对匹配的稳定 `path` 值。
12. 在 `chip-config-loader.ts` 中注册新 JSON。
13. 用包含分配、传输、释放（如适用还有 spill）和分配失败的 trace 进行测试。

注册示例：

```typescript
import * as chipConfigDav3510 from './chip-config-dav3510.json';

const bundledChipConfigs: Record<string, ChipConfig> = {
  DAV_2201: chipConfig910b as ChipConfig,
  DAV_3510: chipConfigDav3510 as ChipConfig,
};
```

## 新芯片 Review 清单

合并新芯片配置前，逐项核对。

| 检查项 | 预期结果 |
| --- | --- |
| Schema 版本 | `schemaVersion` 为 `"1.0"`。 |
| 架构 key | `chip.arch` 精确匹配 trace `metadata.chipArch`。 |
| 节点 id | 每个节点 id 唯一。 |
| 拆分 id | 每个拆分子节点 id 唯一，且不与顶层节点 id 重复。 |
| 父 id | 每个 `parentId` 指向既有的顶层节点。 |
| 内存映射 | 每个 `memoryTypeMap` 目标指向某个节点或拆分子节点。 |
| 容量 | 每个运行时 `memType` 都有数字字节容量。 |
| handle | 每个边 handle 引用在源或目标节点上存在。 |
| 边端点 | 每条边的 source 和 target 都存在。 |
| 边 path | 应动画的传输边有与 adapter 生成的 path key 匹配的 `path`。 |
| 样式 token | 未知样式 token 警告是有意为之或已修复。 |
| 回退 | 不支持的架构回退仍能渲染默认芯片。 |
| 构建 | `npm run compile` 通过。 |

## 故障排查

### Trace 打开时芯片布局错误

检查 trace 中的 `metadata.chipArch`。然后检查同一 key 是否已注册在 `bundledChipConfigs` 中。如果未注册，则回退到默认芯片是预期行为。

### 内存块保持为空

检查以下项：

| 原因 | 修复 |
| --- | --- |
| 运行时 `memType` 缺失于 `memoryTypeMap` | 添加精确的运行时 key。 |
| `memoryTypeMap` 指向错误的节点 id | 将其指向预期的可视化节点或拆分子节点。 |
| buffer status 为 `0` | 已释放的 buffer 不计入活跃占用。 |
| 网格 `unitKB` 过大 | 若小分配需要可见，使用更小的 `unitKB`。 |

### 边不动画

检查以下项：

| 原因 | 修复 |
| --- | --- |
| 边无 `path` | 添加预期的 `E-<SOURCE_MEMTYPE>-<TARGET_MEMTYPE>` path。 |
| path 使用可视化节点 id 而非运行时 memType | 使用运行时内存名，而非节点 id。 |
| 运行时算子缺失 `inputMemIds` 或 `outputMemIds` | 修复 trace 转换，保留端点 id。 |
| 源或目标 buffer 在事件动作列表中找不到 | 确保 `originBufferList` 或 `targetBufferList` 包含相关 `memId`。 |
| path 涉及 `MEM_L0C` 但无 Cube 兼容边 | 若可视化路由经由 Cube，添加 `E-<input>-MEM_CUBE` 和 `E-MEM_CUBE-MEM_L0C` 兼容边。 |

### 分配失败未高亮预期块

检查事件动作是否包含预期的 `errorMemType`，并确保该内存类型已在 `memoryTypeMap` 中映射。对于 `MEM_UB0` 和 `MEM_UB1` 这类独立 bank，每个 bank 都需要各自的映射和容量条目。

### 校验记录未知样式 token

将缺失 token 添加到 `chip-style-resolver.ts`，或用既有的语义 token 替换。不要用大型 `data` 覆盖替代可复用的样式 token。

## 当前限制

| 限制 | 影响 |
| --- | --- |
| 配置在构建时内置 | 用户尚不能在运行时加载任意芯片 JSON 文件。 |
| 边动画基于 path | `animation.pipeTypes` 目前只是文档元数据，不是激活规则。 |
| 部分传输兼容性仍为固定值 | `MEM_GM` path 匹配映射到 `MEM_L2`，`MEM_L0C` 输出通过 Cube 兼容 path 扩展。 |
| 样式 token 有限 | 新的视觉语言需要在代码中添加 resolver token。 |
| canvas 尺寸仅作信息 | 节点放置仍依赖显式坐标。 |

这些限制是首个通用配置版本的有意取舍。它们在保持渲染器稳定的同时，将芯片拓扑移出 Vue 组件代码。
