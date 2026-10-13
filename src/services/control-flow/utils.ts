/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
