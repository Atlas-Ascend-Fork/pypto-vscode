import { Theme, infinityTheme, galaxyTheme } from 'devui-theme';

export const ideLightTheme = new Theme({
  id: 'ide-light-theme',
  name: 'ideLightTheme',
  cnName: 'IDE浅色主题',
  data: {
    ...infinityTheme.data,
    'devui-global-bg': '#f3f3f3', // 全局背景
    'devui-node-badge-bg': 'rgba(0,0,0,0.1)', // 节点右上角徽标背景色
    'devui-node-badge-text': '#595959', // 节点右上角徽标文字
    'devui-op-node-badge-focus-bg': 'rgba(0,0,0,0.2)', // op节点右上角徽标背景色
    'devui-op-node-badge-focus-text': '#ffffff', // op节点右上角徽标文字
    'devui-page-bg': '#fafafa', // 页面背景
    'devui-select-bg': '#ffffff', // 下拉背景
    'devui-card-bg': '#ffffff', // 卡片、面板、弹窗背景
    'devui-nest-bg': 'rgba(0,0,0,0.05)', // 嵌套内容背景
    'devui-flow-chart-nest-bg': '#fafafa', // 流程图嵌套内容背景
    'devui-tab-bg': '#dfdfdf', // tab背景
    'devui-tab-active-bg': '#ffffff', // 选中tag背景
    'devui-alert-bg': '#fabdc1', // alert背景
    'devui-flow-water-bg': '#fde2bd', // OoOSchedule PIPE卡片背景
    'devui-com-graph-pipe-bg': '#dfdfdf', // 计算图pipe背景色
    'devui-input-bg': 'rgba(0,0,0,0.05)', // 输入控件背景
    'devui-input-hover-bg': 'rgba(0,0,0,0.10)', // 悬浮背景
    'devui-input-active-bg': 'rgba(10,89,247,0.20)', // 激活选中背景
    'devui-input-disabled-bg': 'rgba(0,0,0,0.03)', // 输入控件禁用
    'devui-primary-button-bg': '#0a59f7', // 主要按钮默认
    'devui-primary-button-hover-bg': '#3979f9', // 主要按钮悬浮
    'devui-primary-button-active-bg': '#0950de', // 主要按钮按下
    'devui-primary-button-disabled-bg': '#9dbdfc', // 主要按钮禁用
    'devui-secondary-button-bg': '#ffffff', // 次要按钮默认
    'devui-secondary-button-border': 'rgba(0,0,0,0.2)', // 次要按钮默认边框
    'devui-secondary-button-hover-bg': 'rgba(0,0,0,0.13)', // 次要按钮悬浮
    'devui-secondary-button-active-bg': '#c9c9c9', // 次要按钮按下
    'devui-secondary-button-disabled-bg': 'rgba(0,0,0,0.05)', // 次要按钮禁用
    'devui-node-selected-text': '#e6e6e6', // 节点选中颜色
    'devui-op-node-selected-label-text': 'rgba(255, 255, 255, 0.6)', // op节点选中颜色
    'devui-op-node-selected-value-text': 'rgba(255, 255, 255, 0.9)', // op节点选中颜色
    'devui-node-edge': '#aeaeae', // 节点间连线
    'devui-node-edge-active': '#191919', // 节点间连线
    'devui-node-selected-bg': '#c9c9c9',
    'devui-minimap-node-base-color': '#c9c9c9',
    'devui-tensor-node-base-color': '#d3d4dc',
    'devui-tensor-node-light-color': '#5e657a',
    'devui-op-node-base-color': '#cbd4ec',
    'devui-op-node-light-color': '#4266a0',
    'devui-title-text': '#000000', // 标题文字
    'devui-operation-text-hover': '#0a59f7', // 操作文字悬浮色
    'devui-primary-text': '#191919', // 主要文字
    'devui-primary-text-weak': 'rgba(25,25,25,0.3)', // 主要文字弱化
    'devui-secondary-text': '#777777', // 次要文字
    'devui-secondary-text-weak': 'rgba(119,119,119,0.3)', // 次要文字弱化
    'devui-placeholder-text': '#aeaeae', // 占位符
    'devui-placeholder-text-weak': 'rgba(174,174,174,0.3)', // 占位符弱化
    'devui-disabled-text': '#c9c9c9', // 禁用
    'devui-link-text': '#0a59f7', // 文字链接
    'devui-node-label-text': '#595959', // 节点label文字
    'devui-node-bg': '#ffffff', // 节点背景色
    'devui-tooltip-text': '#000000', // 提示框文字颜色
    'devui-tooltip-bg': '#ffffff', // 提示框背景颜色
    'devui-icon': '#595959', // 图标
    'devui-overlay-icon': '#777777', // 图标叠加层
    'devui-placeholder-icon': '#aeaeae', // 占位符
    'devui-disabled-icon': '#c9c9c9', // 禁用
    'devui-hover-icon': '#3979f9', // 悬浮
    'devui-active-icon': '#0a59f7', // 激活
    'devui-status-error': '#e7434a', // 错误色
    'devui-status-error-text': '#c7000b', // 错误色-文字
    'devui-status-error-bg': '#fabdc1', // 错误色-背景
    'devui-status-success': '#488f20', // 成功色
    'devui-status-success-bg-weak': 'rgba(72,143,32,0.2)', // 成功色背景弱化
    'devui-status-info': '#1f55b5', // 信息色
    'devui-status-info-bg-weak': 'rgba(31,85,181,0.2)', // 信息色背景弱化
    'devui-status-success-text': '#488e20', // 成功色-文字
    'devui-status-success-bg': '#dff4cc', // 成功色-背景
    'devui-status-warning': '#c76207', // 警告色
    'devui-status-warning-text': '#c76207', // 警告色-文字
    'devui-status-warning-bg': '#fde2bd', // 警告色-背景
    'devui-split-line': 'rgba(0,0,0,0.1)', // 分割线-浅
    'devui-split-line-deep': '#dfdfdf', // 分割线-深
    'devui-storage-unit-split': '#999999', // 计算图存储单元分割线
    'devui-pipe-warning-line': '#e7434a', // 计算图pipe告警边框
    'devui-pipe-warning-line-weak': 'rgba(231,67,74,0.3)', // 计算图pipe告警边框弱化
    'devui-modal-line': 'rgba(0,0,0,0.2)', // 弹窗内描边
    'devui-tips-shadow': '0 1px 6px 0px rgba(0,0,0,0.08)', // 卡片一级阴影
    'devui-select-shadow': '0 4px 12px 0 rgba(0,0,0,0.16)', // 下拉菜单阴影
    'devui-modal-shadow': '0 16px 48px 0 rgba(0,0,0,0.16)', // 弹窗阴影
    'devui-rose-60': '#e61866',
    'devui-red-60': '#e02128',
    'devui-orange-60': '#f4840c',
    'devui-yellow-60': '#fcc800',
    'devui-green-60': '#62b42e',
    'devui-mint-60': '#09aa71',
    'devui-cyan-60': '#2cb8c9',
    'devui-blue-60': '#2070f3',
    'devui-indigo-60': '#715afb',
    'devui-purple-60': '#b62bf7',
    'devui-pink-60': '#d41dbc',
    'devui-gray-40': '#939393',
    'devui-in-tensor-mini': '#C8DDBD',
    'devui-out-tensor-mini': '#F4CCCE',
    'devui-in-tensor-mini-light': '#488e20',
    'devui-out-tensor-mini-light': '#d2333c',
    'devui-in-wave-fill1': 'rgba(72, 142, 32, 1)',
    'devui-in-wave-fill2': 'rgba(200, 221, 189, 1)',
    'devui-out-wave-fill1': '#d2333c',
    'devui-out-wave-fill2': '#e6c6c7',
    'devui-header-gradient-bg': 'linear-gradient(180.00deg, rgba(250, 250, 250, 1), rgba(250, 250, 250, 0) 100%)',
    'devui-header-label': 'rgba(242,242,242,1)',
    'devui-swim-global-bg': '#ffffff',
    'devui-search-container': '#f2f2f2',
    'devui-swim-split-line': 'rgba(0,0,0,0.05)', // 分割线
    'devui-swim-text-title': 'rgba(25,25,25,1)',
    'devui-font-badge-bg': 'rgba(0,0,0,0.1)', // 节点右上角徽标背景色
    'devui-slider-runway': 'rgba(223,223,223,1)',
    'devui-slider-bar': 'rgba(25,25,25,1)',
    'devui-thread-text': 'rgba(119 ,119, 119, 1)',
    'devui-swim-border-color': 'rgba(0,0,0,0.05)', // 分割线
    'devui-search-container-bg':'rgba(0,0,0,0.05)',
    'devui-slider-container-bg': '#ffffff',
    'devui-button-group-bg':'rgba(0,0,0,0.05)',
    'devui-button-group-hover':'rgba(0,0,0,0.1)',
    'devui-detail-text':'rgba(174,174,174,1)',
    'devui-detail-boxshadow': '0px -16px 48px 0px rgba(0, 0, 0, 0.16)',
    'devui-warning-bg':'rgba(253,226,189,1)'
  },
  isDark: false,
});

export const ideDarkTheme = new Theme({
  id: 'ide-dark-theme',
  name: 'ideDarkTheme',
  cnName: 'IDE深色主题',
  data: {
    ...galaxyTheme.data,
    'devui-global-bg': '#1e1e1e', // 全局背景
    'devui-node-badge-bg': 'rgba(53,53,55,0.5)', // 节点右上角徽标背景色
    'devui-node-badge-text': '#ced1db', // 节点右上角徽标文字
    'devui-op-node-badge-focus-bg': 'rgba(0,0,0,0.2)', // op节点右上角徽标背景色
    'devui-op-node-badge-focus-text': '#191919', // op节点右上角徽标文字
    'devui-page-bg': '#1f1f1f', // 页面背景
    'devui-select-bg': '#363636', // 下拉背景
    'devui-card-bg': '#262626', // 卡片、面板、弹窗背景
    'devui-nest-bg': 'rgba(255,255,255,0.05)', // 嵌套内容背景
    'devui-flow-chart-nest-bg': 'rgba(255,255,255,0.05)', // 流程图嵌套内容背景
    'devui-tab-bg': '#1a1a1a', // tab背景
    'devui-tab-active-bg': 'rgba(255,255,255,0.15)', // 选中tag背景
    'devui-alert-bg': 'rgba(231,67,74,0.2)', // alert背景
    'devui-flow-water-bg': '#4d4d4d', // OoOSchedule PIPE卡片背景
    'devui-com-graph-pipe-bg': '#4d4d4d', // 计算图pipe背景色
    'devui-input-bg': 'rgba(255,255,255,0.05)', // 输入控件背景
    'devui-input-hover-bg': 'rgba(255,255,255,0.10)', // 悬浮背景
    'devui-input-active-bg': 'rgba(49,122,247,0.20)', // 激活选中背景
    'devui-input-disabled-bg': 'rgba(255,255,255,0.03)', // 输入控件禁用
    'devui-primary-button-bg': '#317af7', // 主要按钮默认
    'devui-primary-button-hover-bg': '#5291ff', // 主要按钮悬浮
    'devui-primary-button-active-bg': '#317af7', // 主要按钮按下
    'devui-primary-button-disabled-bg': '#003d83', // 主要按钮禁用
    'devui-secondary-button-bg': '#333333', // 次要按钮默认
    'devui-secondary-button-border': 'rgba(255,255,255,0.05)', // 次要按钮默认边框
    'devui-secondary-button-hover-bg': 'rgba(255,255,255,0.13)', // 次要按钮悬浮
    'devui-secondary-button-active-bg': '#333333', // 次要按钮按下
    'devui-secondary-button-disabled-bg': 'rgba(255,255,255,0.05)', // 次要按钮禁用
    'devui-node-selected-text': 'rgba(25, 25, 25, 1)', // 节点选中颜色
    'devui-op-node-selected-label-text': 'rgba(0, 0, 0, 0.6)', // op节点选中颜色
    'devui-op-node-selected-value-text': 'rgba(0, 0, 0, 0.9)', // op节点选中颜色
    'devui-node-edge': '#666666', // 节点间连线
    'devui-node-edge-active': '#ffffff', // 节点间连线
    'devui-node-selected-bg': '#4c4c4c',
    'devui-minimap-node-base-color': '#626571',
    'devui-tensor-node-base-color': '#6f727d',
    'devui-tensor-node-light-color': '#d1d4e1',
    'devui-op-node-base-color': '#5f729c',
    'devui-op-node-light-color': '#c0d4ff',
    'devui-title-text': '#ffffff', // 标题文字
    'devui-operation-text-hover': '#317af7', // 操作文字悬浮色
    'devui-primary-text': '#e6e6e6', // 主要文字
    'devui-primary-text-weak': 'rgba(230,230,230,0.3)', // 主要文字弱化
    'devui-secondary-text': '#b3b3b3', // 次要文字
    'devui-secondary-text-weak': 'rgba(179,179,179,0.3)', // 次要文字弱化
    'devui-placeholder-text': '#999999', // 占位符
    'devui-placeholder-text-weak': '#999999', // 占位符弱化
    'devui-disabled-text': '#666666', // 禁用
    'devui-link-text': '#317af7', // 文字链接
    'devui-node-label-text': '#999999', // 节点label文字
    'devui-node-bg': '#333333', // 节点背景色
    'devui-tooltip-text': '#e6e6e6', // 提示框文字颜色
    'devui-tooltip-bg': '#363636', // 提示框背景颜色
    'devui-icon': '#e6e6e6', // 图标
    'devui-overlay-icon': '#b3b3b3', // 图标叠加层
    'devui-placeholder-icon': '#999999', // 占位符
    'devui-disabled-icon': '#666666', // 禁用
    'devui-hover-icon': '#5291ff', // 悬浮
    'devui-active-icon': '#317af7', // 激活
    'devui-status-error': '#e7434a', // 错误色
    'devui-status-error-text': '#ee696f', // 错误色-文字
    'devui-status-error-bg': '#59080a', // 错误色-背景
    'devui-status-success': '#a8db81', // 成功色
    'devui-status-success-bg-weak': 'rgba(168,219,129,0.2)', // 成功色背景弱化
    'devui-status-info': '#8ca3fa', // 信息色
    'devui-status-info-bg-weak': 'rgba(140,163,250,0.2)', // 信息色背景弱化
    'devui-status-success-text': '#62b42e', // 成功色-文字
    'devui-status-success-bg': '#1b3e0a', // 成功色-背景
    'devui-status-warning': '#f9b766', // 警告色
    'devui-status-warning-text': '#f9b766', // 警告色-文字
    'devui-status-warning-bg': '#642802', // 警告色-背景
    'devui-split-line': 'rgba(255,255,255,0.1)', // 分割线
    'devui-split-line-deep': '#4d4d4d', // 分割线-深
    'devui-storage-unit-split': '#999999', // 计算图存储单元分割线
    'devui-pipe-warning-line': '#e7434a', // 计算图pipe告警边框
    'devui-pipe-warning-line-weak': 'rgba(231,67,74,0.3)', // 计算图pipe告警边框弱化
    'devui-modal-line': 'rgba(255,255,255,0.2)', // 弹窗内描边
    'devui-tips-shadow': '0 1px 6px 0px rgba(38,38,38,0.08)', // 卡片一级阴影
    'devui-select-shadow': '0 0 16px 0 rgba(0,0,0,0.2)', // 下拉菜单阴影
    'devui-modal-shadow': '0 10px 70px 0 rgba(0,0,0,0.5)', // 弹窗阴影
    'devui-rose-60': '#c40054',
    'devui-red-60': '#c7000b',
    'devui-orange-60': '#c76207',
    'devui-yellow-60': '#d19f00',
    'devui-green-60': '#488e20',
    'devui-mint-60': '#058358',
    'devui-cyan-60': '#1c94a4',
    'devui-blue-60': '#1f55b5',
    'devui-indigo-60': '#5531eb',
    'devui-purple-60': '#8a21bc',
    'devui-pink-60': '#9f1c8d',
    'devui-gray-40': '#4d4d4d',
    'devui-in-tensor-mini': '#44513B',
    'devui-out-tensor-mini': '#69383A',
    'devui-in-tensor-mini-light': '#7AB054',
    'devui-out-tensor-mini-light': '#E7434A',
    'devui-in-wave-fill1': 'rgba(122, 176, 84, 1)',
    'devui-in-wave-fill2': 'rgba(68, 81, 59, 1)',
    'devui-out-wave-fill1': 'rgba(231, 67, 74, 1)',
    'devui-out-wave-fill2': 'rgba(105, 56, 58, 1)',
    'devui-header-gradient-bg': 'linear-gradient(180.00deg, rgba(31, 31, 31, 1), rgba(31, 31, 31, 0) 100%)', // 计算图head渐变色
    'devui-header-label': 'rgba(43, 43, 43, 1)',
    'devui-swim-global-bg': '#1F1F1F',
    'devui-search-container': 'rgba(42,42,42,1)',
    'devui-swim-split-line': 'rgba(255,255,255,0.05)', // 分割线
    'devui-swim-text-title': 'rgba(230,230,230,1)',
    'devui-font-badge-bg': 'rgba(255,255,255,0.1)', // 节点右上角徽标背景色
    'devui-slider-runway': 'rgba(24,24,24,1)',
    'devui-slider-bar': 'rgba(255,255,255,1)',
    'devui-thread-text': 'rgba(153 ,153, 153, 1)',
    'devui-swim-border-color': 'rgba(225,225,225,0.05)', // 分割线
    'devui-search-container-bg':'rgba(42,42,42,1)',
    'devui-slider-container-bg': 'rgba(225,225,225,0.1)',
    'devui-button-group-bg':'rgba(255,255,255,0.1)',
    'devui-button-group-hover':'rgba(255, 255, 255, 0.3)',
    'devui-detail-text':'rgba(153,153,153,1)',
    'devui-detail-boxshadow': '0px 10px 70px 0px rgba(0, 0, 0 ,0.5)',
    'devui-warning-bg':'rgba(246,158,57,0.2)'
  },
  isDark: true,
});
