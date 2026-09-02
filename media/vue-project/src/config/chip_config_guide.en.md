# Generic Chip Memory Visualization Configuration Guide

This guide explains how chip-specific memory layouts are described by JSON configuration instead of hard-coded Vue component logic. The goal is to make memory visualization reusable across chip architectures while keeping runtime memory trace files unchanged.

The current bundled preset is `DAV_2201` / Ascend 910B. Other architectures can be added later by creating another chip config JSON and registering it in the frontend loader.

## Scope

This guide covers the chip layout used by the computation graph memory visualization panel. It describes the static chip config schema, how runtime memory trace data is mapped to visual nodes, how transfer edge animation is matched, and how to add a new bundled chip preset safely.

It does not describe the GM memory usage chart. That view uses a separate region-oriented data model and is documented separately from the right-side chip memory allocation view.

## Design Goals And Non-Goals

The generic chip config feature separates static visualization topology from runtime trace state. This keeps chip-specific layout work in JSON presets and keeps Vue rendering code focused on rendering.

Goals:

| Goal | Reason |
| --- | --- |
| Preserve 910B behavior as the default baseline | Existing users should see the same layout when `metadata.chipArch` is absent or `DAV_2201`. |
| Select bundled presets from `metadata.chipArch` | The trace chooses the chip layout without changing the trace event schema. |
| Keep runtime trace JSON unchanged | Allocation, free, spill, launch, retire, and failure events remain backend-owned runtime data. |
| Move static topology into config | Labels, memory blocks, capacities, coordinates, handles, and edges can vary per chip. |
| Keep styling semantic | Config uses `styleToken` values; theme variables and component details remain frontend-owned. |
| Keep v1 animation compatibility small | Current path-based animation rules stay local to `memoryGraphAdapter.ts`. |

Non-goals for the current version:

| Non-goal | Explanation |
| --- | --- |
| Runtime user-provided config loading | Presets are bundled at build time. |
| Memory trace schema redesign | Existing trace event fields remain the source of dynamic state. |
| Computation graph schema redesign | Chip layout selection is independent from graph schema changes. |
| Backend parsing rewrite | The frontend consumes the same metadata and event payloads. |
| Automatic graph layout generation | Coordinates are explicit in the config. |
| Full animation rule DSL | `animation.pipeTypes` documents intent; activation is still path-based. |

## Relevant Files

| File | Purpose |
| --- | --- |
| `media/vue-project/src/config/chip-config-910b.json` | Bundled default chip memory layout for `DAV_2201`. |
| `media/vue-project/src/config/chip-config-ascend910-95-sample.json` | Bundled sample chip memory layout for `DAV_3510` / Ascend910_95 demo traces. |
| `media/vue-project/src/config/chip-config-loader.ts` | Selects a bundled chip config from `metadata.chipArch`. |
| `media/vue-project/src/config/chip-config.types.ts` | TypeScript schema for chip config fields. |
| `media/vue-project/src/config/chip-config-validator.ts` | Runtime validation for node ids, handles, edges, styles, and capacities. |
| `media/vue-project/src/config/chip-style-resolver.ts` | Maps semantic style tokens to existing Vue node and edge styling. |
| `media/vue-project/src/components/comGraph/memoryGraphAdapter.ts` | Converts chip config plus runtime buffers into Vue Flow nodes and edges. |
| `media/vue-project/src/components/comGraph/comGraphMemory.vue` | Renders the generated Vue Flow graph. It should not contain chip-specific topology. |
| `media/vue-project/src/components/comGraph/memoryAllocation.vue` | Selects the config, receives timeline data, and passes graph data to the renderer. |

## End-To-End Flow

The runtime memory trace remains the source of dynamic state. The chip config only describes static topology and visual mapping.

```text
memory trace metadata.chipArch
  -> chip-config-loader.ts selects a bundled ChipConfig
  -> memoryAllocation.vue converts buffer snapshots into graphData
  -> memoryGraphAdapter.ts combines ChipConfig + graphData + selected event
  -> comGraphMemory.vue renders Vue Flow nodes and edges
```

For the default bundled chip, `metadata.chipArch: "DAV_2201"` selects `chip-config-910b.json`. The bundled sample `metadata.chipArch: "DAV_3510"` selects `chip-config-ascend910-95-sample.json`. If `metadata.chipArch` is missing or unsupported, the loader falls back to the default `DAV_2201` config and logs a warning.

## Runtime Data Versus Static Config

The memory trace provides dynamic state:

| Runtime field | Meaning |
| --- | --- |
| `metadata.chipArch` | Architecture key used to select a bundled config. |
| `timeline[]` | Ordered memory and operation events. |
| `eventType` | Event category such as allocation, free, operation launch, operation retire, or allocation failure. |
| `clock` and `cycleEnd` | Timing used for event list grouping and animation duration. |
| `memId` | Runtime buffer id. Transfer animation uses `inputMemIds` and `outputMemIds` to find source and target buffers. |
| `memType` | Runtime memory type such as `MEM_GM`, `MEM_L2`, `MEM_L1`, `MEM_L0A`, `MEM_L0B`, `MEM_L0C`, or `MEM_UB`. |
| `addrStart` and `size` | Runtime memory occupancy. The adapter converts bytes into visual cell ranges. |
| `status` | Buffer state used for tier colors. Current adapter expects `0`, `1`, or `2`. |
| `inputMemIds` and `outputMemIds` | Operation transfer endpoints used to activate configured edge paths. |
| `errorMemType` | Memory types highlighted during allocation failure. |

The chip config provides static rendering information:

| Config field | Meaning |
| --- | --- |
| `chip` | Identity and display metadata. |
| `legend` | Cell shape and unit labels shown in the memory panel header. |
| `memoryTypeMap` | Runtime `memType` to visual node id mapping. |
| `memoryCapacityBytes` | Capacity per runtime memory type. |
| `nodes` | Static visual blocks such as GM, L2, L1, L0, UB, cache, compute, and containers. |
| `edges` | Static transfer topology and animation path keys. |
| `styleToken` fields | Semantic style references resolved by `chip-style-resolver.ts`. |

## Config Selection

Config selection happens in `selectChipConfig`.

```typescript
const requestedArch = chipArch || DEFAULT_CHIP_ARCH;
const selectedConfig = bundledChipConfigs[requestedArch];
const config = selectedConfig || defaultChipConfig;
```

Current behavior:

| Case | Result |
| --- | --- |
| Trace has `metadata.chipArch: "DAV_2201"` | Uses bundled 910B config. |
| Trace has `metadata.chipArch: "DAV_3510"` | Uses bundled Ascend910_95 sample config. |
| Trace has no `metadata.chipArch` | Uses bundled 910B config. |
| Trace has unsupported `metadata.chipArch` | Uses bundled 910B config and logs a warning. |
| Selected config is invalid | Falls back to 910B when possible and logs validation details. |

When a new chip is ready to be bundled, add its JSON import and architecture mapping in `chip-config-loader.ts`.

```typescript
import * as chipConfigNewArch from './chip-config-new-arch.json';

const bundledChipConfigs: Record<string, ChipConfig> = {
  DAV_2201: chipConfig910b as ChipConfig,
  DAV_XXXX: chipConfigNewArch as ChipConfig,
};
```

## Top-Level Schema

| Field | Required | Description |
| --- | --- | --- |
| `schemaVersion` | Yes | Config schema version. The current validator accepts `"1.0"`. |
| `chip.model` | No | Hardware or product model name, for documentation and diagnostics. |
| `chip.arch` | Yes | Architecture key expected from `metadata.chipArch`, for example `DAV_2201`. |
| `chip.displayName` | Yes | User-facing chip label shown in the memory panel header. |
| `chip.description` | No | Short description of the preset. |
| `canvas.width` | No | Reference width for absolute coordinates. Currently informational. |
| `canvas.height` | No | Reference height for absolute coordinates. Currently informational. |
| `canvas.coordinateSystem` | No | Coordinate description. Current bundled config uses `absolute`. |
| `legend[]` | Yes | Header legend entries for visual memory cell units. |
| `memoryTypeMap` | Yes | Maps runtime memory names to visual node ids or split child ids. |
| `memoryCapacityBytes` | Yes | Capacity per runtime memory type, in bytes. |
| `nodes[]` | Yes | Static visual topology. |
| `edges[]` | Yes | Static transfer topology. |
| `fallbacks` | No | Reserved metadata for future fallback behavior. |

Minimal top-level example:

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

## Legend Entries

The legend is displayed in `memoryAllocation.vue` above the graph. It explains how many KB each rendered cell represents.

| Field | Required | Description |
| --- | --- | --- |
| `shape` | Yes | Cell shape: commonly `square`, `circle`, or `hexagon`. |
| `label` | Yes | Text shown to users, for example `1KB (1024B)`. |
| `unitKB` | Yes | Number of KB represented by one visual cell. |
| `styleToken` | Yes | Semantic legend style token. Current known tokens are `legend.square`, `legend.circle`, and `legend.hexagon`. |

The cell unit must match the node grids that use the same shape. For example, the bundled 910B config uses `unitKB: 8192` for GM hexagons, `unitKB: 128` for L2 circles, and `unitKB: 1` for square local memories.

## Memory Type Mapping

`memoryTypeMap` is the most important part of making a chip generic. It connects runtime memory names from the trace to static visual nodes.

Example from the bundled 910B config:

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

Mapping rules:

| Rule | Explanation |
| --- | --- |
| Key is runtime `memType` | The key must match the trace value exactly after any backend normalization. |
| Value is visual node id | The value must match a `nodes[].id` or a `splitChildren[].id`. |
| Multiple runtime types may map to one visual node | The adapter groups all memory types that map to the same target. This is used for GM aliases such as `MEM_GM` and `MEM_DEVICE_DDR`. |
| Split child ids are valid targets | `MEM_L2` maps to `gm.l2`, which is rendered inside the GM node. |
| Missing mapping means missing runtime display | If a runtime memory type is not mapped, buffers for that type cannot be applied to a visual block. |

The grouping behavior is implemented by `getRelatedMemTypes` in `memoryGraphAdapter.ts`. If `MEM_GM` and `MEM_DEVICE_DDR` both map to `gm`, runtime buffers from both keys are merged when rendering the `gm` node.

## Memory Capacity Mapping

`memoryCapacityBytes` records the physical or logical capacity for each runtime memory type.

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

Important details:

| Detail | Explanation |
| --- | --- |
| Unit is bytes | Do not store KB or MB here. The adapter converts bytes to KB when needed. |
| Keep keys aligned with `memoryTypeMap` | Every runtime memory type that can appear in trace data should have both a map entry and a capacity. |
| Capacity is used for graph data initialization | `buildGraphDataFromBuffers` creates an entry for every known memory type from both `memoryCapacityBytes` and `memoryTypeMap`. |
| Capacity does not define grid size by itself | The visible grid is controlled by `nodes[].grid.rows`, `nodes[].grid.cols`, and `nodes[].grid.unitKB`. |

The visible grid should usually be large enough to represent the configured capacity after converting bytes to the node cell unit. For example, a `253952` byte UB is `248KB`; a square grid with `unitKB: 1` should have at least `248` cells if full-capacity display is required.

## Node Schema

Nodes define the static topology. They are converted to Vue Flow nodes by `buildFlowNode`.

| Field | Required | Description |
| --- | --- | --- |
| `id` | Yes | Unique visual node id. Used by `memoryTypeMap`, `parentId`, and edges. |
| `kind` | Yes | Semantic type such as `memory`, `container`, `compute`, `cache`, or `hidden`. |
| `component` | Yes | Vue Flow node component. Common values are `gridNode` and `vectorNode`. |
| `label` | Yes | Text rendered in the node. |
| `memType` | No | Runtime memory type represented by this node. Required for runtime occupancy on normal nodes. |
| `parentId` | No | Container node id. Child positions are relative to the parent. |
| `position.x` and `position.y` | No | Node position. Defaults to `{ x: 0, y: 0 }` if omitted. |
| `size.width` and `size.height` | No | Dimensions for vector/container/compute nodes. |
| `grid.rows` | For grid memory | Number of grid rows. |
| `grid.cols` | For grid memory | Number of grid columns. |
| `grid.shape` | For grid memory | Cell shape: `square`, `circle`, `hexagon`, or a component-supported custom value. |
| `grid.unitKB` | For grid memory | KB represented by one cell. Used for `filledCount`, tiers, and animation speed. |
| `styleToken` | No | Semantic style token. Defaults to `memory.l1` if omitted. |
| `showHeader` | No | Overrides whether the node header is shown. |
| `showStats` | No | Enables memory usage stats display on supported grid nodes. |
| `splitType` | No | Layout direction for `splitChildren`, such as `horizontal`. |
| `visibility` | No | `hidden` creates a routing/anchor node without visible UI. |
| `handles[]` | No | Edge connection anchors. Required when edges reference handle ids. |
| `splitChildren[]` | No | Memory blocks rendered inside the same visual node. Used by GM containing L2. |
| `initialFilledCount` | No | Static fill before runtime state is applied. Runtime trace data overrides it after graph data is available. |
| `data` | No | Small component-specific visual overrides. Use sparingly; prefer schema fields and style tokens. |

### Memory Node Example

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

### Container Node Example

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

### Split Child Example

The bundled 910B graph renders L2 inside GM. This avoids a separate top-level L2 node while still allowing runtime `MEM_L2` data to map independently.

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

Handles are optional connection anchors. They are useful when an edge must attach to a precise side or percentage of a node.

| Field | Required | Description |
| --- | --- | --- |
| `id` | Yes | Unique inside the node. Edges reference this id. |
| `type` | No | `source` or `target`. Used by Vue Flow semantics. |
| `edge` | Yes | Node side: `top`, `bottom`, `left`, or `right`. |
| `pct` | Yes | Anchor position on that side. Number values are percentages; string values such as `55px` are supported by the node component. |

Example:

```json
{
  "id": "aic-l1-r-25",
  "type": "source",
  "edge": "right",
  "pct": 25
}
```

The validator checks that every `sourceHandle` and `targetHandle` referenced by an edge exists on the corresponding node.

## Edge Schema

Edges define the static transfer topology. They are converted to Vue Flow edges by `buildFlowEdge`.

| Field | Required | Description |
| --- | --- | --- |
| `id` | Yes | Unique edge id. |
| `source` | Yes | Source visual node id. |
| `target` | Yes | Target visual node id. |
| `sourceHandle` | No | Handle id on the source node. |
| `targetHandle` | No | Handle id on the target node. |
| `path` | Recommended | Runtime animation lookup key, for example `E-MEM_L1-MEM_L0A`. |
| `label` | No | Label rendered on the edge, for example `MTE_1`. |
| `styleToken` | No | Semantic edge style token. Defaults to `pipe.compute`. |
| `dash` | No | Enables dashed orange styling and edge animation styling. |
| `doubleArrow` | No | Indicates bidirectional relation on supported edge rendering. |
| `labelX`, `labelY` | No | Manual label position override. |
| `labelWidth`, `labelHeight` | No | Manual label size override. |
| `borderRadius` | No | Label border radius override. |
| `markerEnd` | No | Arrow marker override. Set to `false` to suppress the default arrow. |
| `waypoints` | No | Manual route points for custom edge path rendering. |
| `animation.enabled` | No | Documentation flag for whether this edge should animate. Current activation is based on `path`. |
| `animation.pipeTypes` | No | Pipe types associated with this edge, such as `PIPE_MTE1`. Current adapter does not match by pipe type. |

Example:

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

## Style Tokens

Style tokens keep config JSON semantic. They avoid duplicating CSS and component details in every node.

Current known node style tokens:

| Token | Use |
| --- | --- |
| `memory.gm` | GM grid styling. |
| `memory.l2` | L2 split grid styling. |
| `memory.l1` | Square local memory styling. |
| `memory.l0` | L0 memory styling. |
| `memory.ub` | UB memory styling. |
| `memory.cache` | DCache/ICache style. |
| `memory.scalar` | Scalar block style. |
| `container.core` | AIC/AIV container style. |
| `compute.cube` | Cube compute block style. |
| `compute.vector` | Vector compute block style. |
| `pipe.fixpipe` | Hidden/fixpipe helper style. |

Current known edge style tokens:

| Token | Use |
| --- | --- |
| `pipe.mte` | Memory transfer edges. |
| `pipe.fixpipe` | FixPipe edges. |
| `pipe.compute` | Compute/data path edges. |
| `pipe.cache` | Cache-related edges. |

Unknown style tokens produce validation warnings. They do not currently block rendering, but the resolver falls back to default styles.

## Runtime Occupancy Mapping

Runtime occupancy is applied in `applyMemoryRuntimeToData`.

For each memory visual node:

1. The adapter finds all runtime memory types related to the node through `memoryTypeMap`.
2. It reads the current buffer list from `graphData`.
3. It computes active bytes by summing buffers whose `status` is not `0`.
4. It converts active bytes into a visual `filledCount` using `grid.unitKB`.
5. It converts every buffer into a tier range with `startLocation`, `size`, `color`, and `bufferMsg`.

The key formula is:

```text
filledCount = ceil(sum(activeBuffer.size) / 1024 / node.grid.unitKB)
```

Tier location and tier size use the same unit:

```text
startLocation = buffer.addrStart / 1024 / node.grid.unitKB
size          = buffer.size      / 1024 / node.grid.unitKB
```

This means `unitKB` must be chosen carefully. A small local memory usually uses `unitKB: 1` so each square represents 1KB. A large GM block usually uses a much larger value so the graph remains readable.

## Runtime Animation Mapping

Edge animation is generic but path-based. During an event, `buildAnimationState` looks at `inputMemIds` and `outputMemIds`. It finds the matching buffers in `originBufferList` or `targetBufferList`, reads their `memType`, and builds transfer path keys.

For a transfer from `MEM_L1` to `MEM_L0A`, the active path is:

```text
E-MEM_L1-MEM_L0A
```

Any config edge with `path: "E-MEM_L1-MEM_L0A"` receives animation data.

Special cases:

| Case | Behavior |
| --- | --- |
| Source or target runtime type is `MEM_GM` | Path matching treats it as `MEM_L2`. This preserves existing 910B transfer behavior. |
| Output memory is `MEM_L0C` | The adapter also activates `E-<input>-MEM_CUBE` and `E-MEM_CUBE-MEM_L0C` so Cube-compatible paths can animate. |
| `animation.pipeTypes` exists on config edge | It documents intended pipe semantics, but current activation still depends on `edge.path`. |

Example from a DAV_3510-style demo trace:

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

If `memId: 101` is in `MEM_L1`, `memId: 102` is in `MEM_L0A`, and `memId: 103` is in `MEM_L0B`, the adapter activates:

```text
E-MEM_L1-MEM_L0A
E-MEM_L1-MEM_L0B
```

## Allocation Failure Mapping

Allocation failure uses `errorMemType` from the selected event action. If a failure is associated with `MEM_UB`, the adapter marks the visual UB node as animated/error state through the same runtime memory mapping.

For a DAV_3510-style trace, a failure event may look like this:

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

To highlight this independently from another UB block, the chip config must include `MEM_UB1` in `memoryTypeMap` and `memoryCapacityBytes`, and the trace-to-event conversion must preserve `errorMemType: ["MEM_UB1"]` in the action payload.

## DAV_3510 Demo Context

Development demos may use files such as:

| Demo file | Role |
| --- | --- |
| `demo_Ascend910_95.json` | Matching computation graph with demo operation magic ids. |
| `demo_Ascend910_95_OoO_Memory_Trace.json` | Runtime memory trace with `metadata.chipArch: "DAV_3510"`. |
| `chip-config-ascend910-95-sample.json` | Bundled sample config selected for `DAV_3510`. |

The demo trace is useful because it exercises behavior that differs from the 910B baseline:

| Trace behavior | Why it matters for config design |
| --- | --- |
| `metadata.chipArch: "DAV_3510"` | Demonstrates architecture-based config selection. This key selects the bundled Ascend910_95 sample config. |
| Separate `MEM_UB0` and `MEM_UB1` events | Demonstrates that multiple UB blocks require distinct runtime memType keys and distinct visual node ids. |
| `MEM_L1 -> MEM_L0A` and `MEM_L1 -> MEM_L0B` operation | Demonstrates one source memory activating multiple transfer paths. |
| `MEM_L0A`/`MEM_L0B` -> MEM_L0C` through Cube | Demonstrates the current Cube/L0C animation expansion. |
| `ALLOC_FAIL` on `MEM_UB1` | Demonstrates independent failure highlighting for a specific memory bank. |

The current branch bundles `DAV_3510` in `chip-config-loader.ts`, so the demo trace should select the sample topology directly. If that mapping is removed in a future cleanup, the trace will safely fall back to the default 910B config but will no longer show the custom DAV_3510 topology.

## Adding A New Bundled Chip

Use this process when a chip owner provides a new architecture layout.

Before writing JSON, collect the static visualization contract from the chip or architecture owner. The maintainer does not need full chip-design knowledge; they need enough stable topology information to map runtime memory events to a readable graph.

Suggested request:

```text
I need the static memory visualization topology for chip architecture <chipArch>.
Please provide the memory blocks visible to users, their capacities, compute engines/containers, cache blocks, and legal transfer paths between memories/engines.
The output will be mapped into a config JSON with nodes, edges, capacities, and runtime memory-type mappings.
```

Information to request:

| Required information | Config field | Example |
| --- | --- | --- |
| Architecture id emitted in trace metadata | `chip.arch` and loader mapping | `DAV_3510` |
| User-facing chip name | `chip.displayName` | `Ascend910_95 Sample` |
| Memory regions visible to users | `nodes[]` with `kind: "memory"` | `GM`, `L2`, `L1`, `L0A`, `L0B`, `L0C`, `UB0`, `UB1` |
| Capacity of each memory region in bytes | `memoryCapacityBytes` | `"MEM_UB1": 253952` |
| Runtime `memType` emitted by trace events | `memoryTypeMap` keys | `MEM_UB0`, `MEM_UB1` |
| Visual target for each runtime memory type | `memoryTypeMap` values | `"MEM_UB1": "aiv1-ub"` |
| Grouping regions | `nodes[]` with `kind: "container"` | `AIC`, `AIV0`, `AIV1` |
| Compute engines | `nodes[]` with `kind: "compute"` | `Cube`, `Vector`, `Scalar` |
| Cache blocks | `nodes[]` with `kind: "cache"` | `DCache`, `ICache` |
| Legal data movement paths | `edges[]` | `L2 -> L1`, `L1 -> L0A`, `UB -> Vector` |
| Pipe names and runtime pipe types | edge `label`, `animation.pipeTypes` | `MTE_1`, `PIPE_MTE1` |
| Visual parity versus hardware-spec accuracy | node coordinates, grid sizing, labels | Preserve existing 910B layout or use chip-owner layout |

1. Create `chip-config-<arch-or-model>.json` under `media/vue-project/src/config/`.
2. Set `schemaVersion` to `"1.0"`.
3. Set `chip.arch` to the exact value emitted by trace `metadata.chipArch`.
4. Define the legend cell units before designing grids.
5. List every runtime memory type in `memoryTypeMap`.
6. List every runtime memory type capacity in `memoryCapacityBytes` using bytes.
7. Build container nodes first, such as AIC/AIV groups.
8. Add memory nodes with `memType`, `grid`, `styleToken`, and positions.
9. Add compute/cache/helper nodes needed for readable transfer routing.
10. Add handles only where edge placement needs exact anchors.
11. Add edges with stable `path` values matching runtime memory transfer pairs.
12. Register the new JSON in `chip-config-loader.ts`.
13. Test with a trace that includes allocation, transfer, free, spill if applicable, and allocation failure.

Registration example:

```typescript
import * as chipConfigDav3510 from './chip-config-dav3510.json';

const bundledChipConfigs: Record<string, ChipConfig> = {
  DAV_2201: chipConfig910b as ChipConfig,
  DAV_3510: chipConfigDav3510 as ChipConfig,
};
```

## New Chip Review Checklist

Before merging a new chip config, verify each item.

| Check | Expected result |
| --- | --- |
| Schema version | `schemaVersion` is `"1.0"`. |
| Architecture key | `chip.arch` exactly matches trace `metadata.chipArch`. |
| Node ids | Every node id is unique. |
| Split ids | Every split child id is unique and does not duplicate a top-level node id. |
| Parent ids | Every `parentId` points to an existing top-level node. |
| Memory map | Every `memoryTypeMap` target points to a node or split child. |
| Capacities | Every runtime `memType` has a numeric byte capacity. |
| Handles | Every edge handle reference exists on the source or target node. |
| Edge endpoints | Every edge source and target exists. |
| Edge paths | Transfer edges that should animate have a `path` matching adapter-generated path keys. |
| Style tokens | Unknown style token warnings are intentional or fixed. |
| Fallback | Unsupported architecture fallback still renders the default chip. |
| Build | `npm run compile` passes. |

## Troubleshooting

### The Trace Opens With The Wrong Chip Layout

Check `metadata.chipArch` in the trace. Then check whether the same key is registered in `bundledChipConfigs`. If it is not registered, fallback to the default chip is expected.

### A Memory Block Stays Empty

Check these items:

| Cause | Fix |
| --- | --- |
| Runtime `memType` is missing from `memoryTypeMap` | Add the exact runtime key. |
| `memoryTypeMap` points to the wrong node id | Point it to the intended visual node or split child. |
| Buffer status is `0` | Freed buffers do not count as active occupancy. |
| Grid `unitKB` is too large | Use a smaller `unitKB` if small allocations should be visible. |

### An Edge Does Not Animate

Check these items:

| Cause | Fix |
| --- | --- |
| Edge has no `path` | Add the expected `E-<SOURCE_MEMTYPE>-<TARGET_MEMTYPE>` path. |
| Path uses visual node ids instead of runtime memTypes | Use runtime memory names, not node ids. |
| Runtime operation has missing `inputMemIds` or `outputMemIds` | Fix trace conversion so endpoint ids are preserved. |
| Source or target buffer cannot be found in event action lists | Ensure `originBufferList` or `targetBufferList` contains the relevant `memId`. |
| Path involves `MEM_L0C` but no Cube-compatible edge exists | Add `E-<input>-MEM_CUBE` and `E-MEM_CUBE-MEM_L0C` compatible edges if the visual route goes through Cube. |

### Allocation Failure Does Not Highlight The Expected Block

Check that the event action contains the expected `errorMemType`, and that the memory type is mapped in `memoryTypeMap`. For independent banks such as `MEM_UB0` and `MEM_UB1`, each bank needs its own mapping and capacity entry.

### Validation Logs Unknown Style Tokens

Add the missing token to `chip-style-resolver.ts` or replace the token with an existing semantic token. Do not use large `data` overrides as a substitute for reusable style tokens.

## Current Limitations

| Limitation | Impact |
| --- | --- |
| Configs are bundled at build time | Users cannot load arbitrary chip JSON files at runtime yet. |
| Edge animation is path-based | `animation.pipeTypes` is documentation metadata today; it is not the activation rule. |
| Some transfer compatibility is still hard-coded | `MEM_GM` path matching maps to `MEM_L2`, and `MEM_L0C` output expands through Cube-compatible paths. |
| Style tokens are finite | New visual languages require adding resolver tokens in code. |
| Canvas size is informational | Node placement still depends on explicit coordinates. |

These limitations are intentional for the first generic configuration version. They keep the renderer stable while moving chip topology out of Vue component code.
