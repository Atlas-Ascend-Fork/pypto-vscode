# Vue前端模块

## 概览

Webview前端。100+ Vue组件，D3.js图渲染，Sprotty-ELK布局，SQL.js内存数据库。

## 结构

```
src/
├── main.ts               # Vue入口
├── App.vue               # 根组件
├── components/           # UI组件
│   ├── comGraph/         # 计算图组件
│   ├── swimGraph/        # 泳道图组件
│   ├── diffComGraph/     # 差异图组件
│   ├── threeColumn/      # 三栏联动组件
│   └── navbar/           # 导航栏
├── core/                 # 核心逻辑
│   ├── state.ts          # 状态管理 (⚠️ 避免全局缓存)
│   ├── sprotty-graph/    # Sprotty图引擎
├── static-assets/        # 静态资源 (用staticPath)
└── sprotty-graph/        # Sprotty封装
```

## 查找指南

| 功能 | 目录/文件 | 关键组件 |
|------|-----------|----------|
| 计算图渲染 | `components/comGraph/` | ComGraph.vue |
| 泳道图渲染 | `components/swimGraph/` | SwimGraph.vue |
| 差异对比 | `components/diffComGraph/` | DiffComGraph.vue |
| 三栏联动 | `components/threeColumn/` | ThreeColumn.vue |
| Sprotty引擎 | `sprotty-graph/` | SprottyGraph |
| 状态管理 | `core/state.ts` | ⚠️ 已废弃 |

## 约定

### 静态资源路径
```javascript
// 必须用window.staticPath拼接
const icon = `${window.staticPath}/boot_steps/icon.svg`
```

### 图组件通信
- 父→子: props传递图数据
- 子→父: emit事件上报交互

### D3.js使用
- 计算图: D3拖拽/缩放
- 泳道图: D3时间轴

## 反模式

### 禁止全局State缓存
```typescript
// @deprecated 尽量避免使用state缓存，容易导致全局冲突
// core/state.ts - 已废弃
```

### 禁止硬编码路径
```javascript
// 错误
const icon = '/static-assets/icon.svg'
// 正确
const icon = `${window.staticPath}/icon.svg`
```

## 构建

```bash
cd vscode_plugins/pypto_toolkit/media/vue-project
npm run dev      # Vite热更新
npm run build    # 输出到webview-dist/
npm run test:memory # GM内存可视化单元测试
```
