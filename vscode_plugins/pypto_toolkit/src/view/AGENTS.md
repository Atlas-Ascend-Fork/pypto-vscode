# 视图层模块

## 概览

VSCode Webview视图提供者。计算图、泳道图、控制流、三栏联动、侧边栏、欢迎页。

## 结构

```
view/
├── index.ts              # 视图初始化入口
├── graphView.ts          # 计算图视图
├── swimGraphView.ts      # 泳道图视图
├── threeColumnEntry.ts   # 三栏联动入口
├── SidebarViewProvider.ts # 侧边栏视图
├── pyptoJitCodeLensProvider.ts # CodeLens
├── servers/              # Webview服务器
│   ├── com-graph-server.ts
│   ├── swim-graph-server.ts
│   ├── controlFlow-server.ts
│   └── sidebar-view-server.ts
└── routes.ts             # 视图路由
```

## 查找指南

| 功能 | 文件 | 类/函数 |
|------|------|---------|
| 打开计算图 | `graphView.ts` | GraphView.createOrShow() |
| 打开泳道图 | `swimGraphView.ts` | SwimGraphView.createOrShow() |
| 三栏联动 | `threeColumnEntry.ts` | ThreeColumnEntry.open() |
| 侧边栏 | `SidebarViewProvider.ts` | SidebarViewProvider |
| CodeLens | `pyptoJitCodeLensProvider.ts` | PyptoJitCodeLensProvider |
| 消息处理 | `servers/*.ts` | ViewServer子类 |

## 约定

- **Webview通信**: 使用`request-server.ts`的RequestServer
- **视图状态**: 通过`context.globalState`持久化
- **生命周期**: `activate()` → `initView()` → registerCommand

## 反模式

- **禁止内联HTML**: Webview内容必须来自Vue构建产物
- **禁止直接操作DOM**: 通过消息协议通信