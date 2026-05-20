# 项目知识库

**生成时间**: 2025-05-19
**Commit**: e11ae8a6
**分支**: mix

## 概览

PyPTO Toolkit - 华为PyPTO框架VSCode可视化插件。为AI算子开发者提供计算图、泳道图、控制流可视化及三栏联动调试能力。**核心语言栈: TypeScript + Vue.js**（非Python项目）。

## 结构

```
pypto-tools/
├── vscode_plugins/
│   ├── pypto_toolkit/          # VSCode扩展主模块
│   │   ├── src/                # TypeScript源码 (100+文件)
│   │   │   ├── extension.ts    # 扩展入口
│   │   │   ├── view/           # 视图提供者
│   │   │   ├── services/       # 业务服务
│   │   │   ├── core/           # 核心存储
│   │   │   ├── handler/        # 消息处理
│   │   │   ├── converter/      # 数据转换器
│   │   │   └── types/          # 类型定义
│   │   ├── media/vue-project/  # Vue前端 (100+文件)
│   │   ├── package.json        # 扩展配置
│   │   └── tsconfig.json       # TypeScript配置
│   └── docs/                   # Sphinx文档 (38个md)
│       ├── conf.py             # 文档构建配置
│       └── requirements.txt    # Sphinx依赖
└── README.md
```

## 查找指南

| 任务 | 位置 | 说明 |
|------|------|------|
| 扩展入口 | `vscode_plugins/pypto_toolkit/src/extension.ts` | activate()初始化服务/视图/命令 |
| 命令注册 | `vscode_plugins/pypto_toolkit/src/command/registerCommand.ts` | VSCode命令映射 |
| 计算图视图 | `vscode_plugins/pypto_toolkit/src/view/graphView.ts` | ComGraph渲染 |
| 泳道图视图 | `vscode_plugins/pypto_toolkit/src/view/swimGraphView.ts` | Swimlane渲染 |
| 三栏联动 | `vscode_plugins/pypto_toolkit/src/view/threeColumnEntry.ts` | 代码-计算图-泳道图联动 |
| 控制流服务 | `vscode_plugins/pypto_toolkit/src/services/control-flow/` | PATH解析/树构建 |
| SQLite缓存 | `vscode_plugins/pypto_toolkit/src/core/store/sql-store/` | 图数据持久化 |
| Vue前端 | `vscode_plugins/pypto_toolkit/media/vue-project/src/` | Webview组件 |
| Python转换器 | `vscode_plugins/pypto_toolkit/src/converter/swimlane_converter.py` | 泳道JSON→Perfetto |
| 文档构建 | `vscode_plugins/docs/` | Sphinx文档 |

## 约定

### TypeScript
- **行宽**: 140字符 (ESLint + Prettier一致)
- **缩进**: 2空格
- **分号**: 必须
- **引号**: 单引号
- **尾逗号**: 全部 (ES5兼容)
- **装饰器**: 开启 (`experimentalDecorators`)

### Python (有限)
- 仅4个Python文件，无pyproject.toml
- **编码**: `# coding: utf-8`
- **文档**: Google/Numpy风格docstring
- **类型**: 使用类型注解
- **CLI**: argparse标准库

### 命名
- 文件: 小写+连字符 (`swim-graph-view.ts`)
- 类: PascalCase (`SwimGraphView`)
- 方法: camelCase (`loadMainData`)
- 常量: UPPER_SNAKE_CASE

## 反模式

### 避免全局State缓存
```typescript
// @deprecated 尽量避免使用state缓存，容易导致全局冲突
// media/vue-project/src/core/state.ts
```

### 子类必须覆盖
```typescript
// src/handler/baseGraphMsgHandler.ts
throw new Error('子类必须覆盖 loadMainData 方法');
throw new Error('子类必须覆盖 getGraphData 方法');
```

## 唯特风格

### 双构建系统
- npm scripts → TypeScript编译
- Vite → Vue webview热更新
- 同步执行: `npm run compile` 先Vue后TS

### 静态资源路径
```typescript
// Vue前端必须用window.staticPath拼接
const iconPath = `${window.staticPath}/icons/...`
```

### 模块懒加载
- 服务按需启动 (`startAllServices`)
- 视图延迟注册 (`initView`)
- SQLite缓存首次加载清理 (`globalState`)

## 命令

```bash
# 开发模式 (热更新)
cd vscode_plugins/pypto_toolkit && npm run watch

# 构建
npm run compile

# 文档构建
cd vscode_plugins/docs && make html

# Python转换器
python -m simpler_setup.tools.swimlane_converter l2_perf_records.json -o out.json
```

## 注意事项

- **非Python项目**: 名称误导，实为TS+Vue扩展
- **环境依赖**: 运行需CANN环境 + NPU设备
- **Git LFS**: 预发布时自动拉取 (`vscode:prepublish`)
- **版本检查**: 启动5秒后检测旧版本并自动卸载
- **缓存清理**: 新版本首次使用清空SQLite缓存

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **pypto-tools** (12596 symbols, 21149 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/pypto-tools/context` | Codebase overview, check index freshness |
| `gitnexus://repo/pypto-tools/clusters` | All functional areas |
| `gitnexus://repo/pypto-tools/processes` | All execution flows |
| `gitnexus://repo/pypto-tools/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
