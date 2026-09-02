# TypeScript核心模块

## 概览

VSCode扩展核心逻辑。100+文件，6大模块：view/services/core/handler/converter/types。

## 结构

```
src/
├── extension.ts         # 入口: activate()初始化
├── command/             # 命令注册
├── config/              # 配置管理
├── view/                # 视图层 (15文件)
├── services/            # 业务层 (15文件)
├── core/                # 存储层 (12文件)
├── handler/             # 消息处理
├── converter/           # 数据转换
└── types/               # TypeScript类型
```

## 查找指南

| 模块 | 入口文件 | 核心类 |
|------|----------|--------|
| 命令系统 | `command/registerCommand.ts` | RegisterCommand |
| 视图管理 | `view/index.ts` | initView() |
| 计算图 | `view/graphView.ts` | GraphView |
| 泳道图 | `view/servers/swim-graph-server.ts` | SwimGraphServer |
| 三栏联动 | `view/threeColumnEntry.ts` | ThreeColumnEntry |
| 控制流 | `services/control-flow/index.ts` | ControlFlowService |
| 存储管理 | `core/store/index.ts` | initStores() |
| SQLite | `core/store/sql-store/sql-store.ts` | SqlStore |

## 约定

- **入口导出**: 模块必须有`index.ts`
- **服务命名**: `*Service` / `*Manager`
- **视图命名**: `*View` / `*ViewProvider`
- **Handler命名**: `*Handler` / `*MsgHandler`

## 反模式

- **禁止直接修改globalConfig**: 使用`config/config.ts`封装
- **禁止跨模块直接引用**: 通过services暴露API

## 关键依赖

```
extension.ts → services → view → handler → core
```