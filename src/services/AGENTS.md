# 服务层模块

## 概览

业务逻辑封装。控制流解析、运行数据扫描、配置管理、欢迎页示例、PyptoJit调试。

## 结构

```text
services/
├── index.ts              # 服务聚合入口
├── basic-service.ts      # 服务基类
├── control-flow/         # 控制流服务
│   ├── index.ts, store.ts, flow-tree.ts
│   ├── path-leaf.ts, condition.ts
├── run-data/             # 运行数据服务
│   ├── index.ts, api.ts
│   ├── utils/scan-run-data.ts
├── schema-config/        # 配置Schema
│   ├── index.ts, configdata.ts
├── welcome/              # 欢迎页服务
│   ├── index.ts, sample.ts, run-python.ts
├── pyptoJitService.ts    # PyptoJit调试
└── extension-config.ts   # 扩展配置
```

## 查找指南

| 功能 | 文件 | 关键API |
|------|------|---------|
| 控制流解析 | `control-flow/index.ts` | parseControlFlow() |
| PATH树构建 | `control-flow/flow-tree.ts` | buildFlowTree() |
| 运行数据扫描 | `run-data/utils/scan-run-data.ts` | scanRunData() |
| 配置Schema | `schema-config/configdata.ts` | loadSchema() |
| 示例管理 | `welcome/sample.ts` | SampleManager |
| PyptoJit调试 | `pyptoJitService.ts` | setDebugOptions() |

## 约定

- **服务生命周期**: `startAllServices()` → 单例模式
- **API暴露**: 通过`serviceApis`对象导出
- **异步操作**: 使用`async-resolving-list.ts`队列

## 反模式

- **禁止阻塞启动**: 服务初始化必须非阻塞
- **禁止跨服务直接调用**: 通过index.ts聚合API
