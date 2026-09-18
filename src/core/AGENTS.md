# 核心存储层

## 概览

数据持久化与缓存。SQLite存储、JSON图解析、布局引擎、请求服务器。

## 结构

```text
core/
├── store/                # 存储管理
│   ├── index.ts          # 存储初始化
│   └── sql-store/        # SQLite存储
│       ├── sql-store.ts          # 主存储类
│       ├── sql-store-manager.ts  # 多实例管理
│       ├── sql-store-query.ts    # 查询封装
│       ├── sql-table-controller.ts
│       └── data-file-controller.ts
├── json-graph/           # JSON图解析
│   └── jsonGraph.ts
├── layoutWork.ts         # ELK布局
├── graphData.ts          # 图数据处理
├── connector.ts          # 节点连接器
├── request-server.ts     # Webview请求服务器
├── view/                 # 视图服务器基类
│   ├── view-server.ts, view-server-context.ts
└── sqlInit.ts, swimSqlInit.ts  # SQL初始化
```

## 查找指南

| 功能 | 文件 | 关键类 |
|------|------|--------|
| SQLite存储 | `store/sql-store/sql-store.ts` | SqlStore |
| 存储初始化 | `store/index.ts` | initStores() |
| 图解析 | `json-graph/jsonGraph.ts` | JsonGraph |
| ELK布局 | `layoutWork.ts` | layoutWork() |
| 请求服务 | `request-server.ts` | RequestServer |

## 约定

- **存储路径**: `context.globalStorageUri.fsPath`
- **缓存清理**: 版本变更时自动清理
- **SQL初始化**: 使用sql.js WASM引擎

## 反模式

- **禁止直接写文件**: 通过SqlStore封装
- **禁止缓存无限增长**: 限制存储大小
