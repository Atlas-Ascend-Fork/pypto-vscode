/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import type { FunctionNode } from '../../types/control-flow';
import type { ExecuteFunction } from '../../types/execute-graph';

export function functionNodeToExecuteFunction(functionNode: FunctionNode): ExecuteFunction {
  return {
    magic: functionNode.funcmagic,
    magicName: getFunctionName(functionNode),
    hash: functionNode.hash,
  };
}

export function getFunctionName(functionNode: FunctionNode): string {
  return functionNode.rawname.replace(/_root$/, '');
}

/**
 * 根据完整路径名判断文件对应的语言/类型
 * @param filePath 完整路径
 * @returns 语言/文件类型名称
 */
export const getLanguageIdByFilePath = (filePath: string): string => {
  const fileName = filePath.split(/[\\/]/).pop() || '';
  if (!fileName.includes('.')) return 'plaintext';

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const extToLangIdMap = {
    // 前端相关
    js: 'javascript',
    jsx: 'javascriptreact',
    ts: 'typescript',
    tsx: 'typescriptreact',
    vue: 'vue',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    // 后端/脚本
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    rb: 'ruby',
    kt: 'kotlin',
    swift: 'swift',
    dart: 'dart',
    lua: 'lua',
    sh: 'shellscript',
    ps1: 'powershell',
    // 数据格式/配置
    json: 'jsonc',
    jsonc: 'jsonc',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    ini: 'ini',
    toml: 'toml',
    csv: 'csv',
    // 文档/标记
    md: 'markdown',
    markdown: 'markdown',
    asciidoc: 'asciidoc',
    txt: 'plaintext',
    // 其他常用
    sql: 'sql',
    dockerfile: 'dockerfile',
    gitignore: 'gitignore',
    gitconfig: 'gitconfig',
    nginx: 'nginx',
    conf: 'ini',
  };

  return extToLangIdMap[ext as keyof typeof extToLangIdMap] || 'plaintext';
};
