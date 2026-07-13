/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
export const lineToSemanticMap = new Map<number, string>();
export let labels: SemanticRange[] = [];

function normalize(filePath: string) {
  if (filePath.includes('\\')) {
    const driveLetter = filePath[0].toLowerCase();
    const _path = filePath.slice(1);
    return `${driveLetter}${_path}`;
  }
  return filePath;
}

export function mkSemanticLabel(semanticObj: any, filePath: string) {
  const nfilePath = normalize(filePath);
  lineToSemanticMap.clear();
  const line2label = semanticObj[nfilePath];
  if (!line2label) {
    return;
  }
  Object.keys(line2label).forEach((line: any) => {
    lineToSemanticMap.set(line, line2label[line]);
  });
}

export interface SemanticRange {
  name: string;
  startLine: number;
  endLine: number;
}

export function parseSemanticLabels(totalLines: number): SemanticRange[] {
  labels = [];
  
  // 边界情况处理
  if (lineToSemanticMap.size === 0 || totalLines <= 0) {
    return labels;
  }
  
  const labeledLines = Array.from(lineToSemanticMap.keys())
    .sort((a, b) => a - b)
    .filter(line => line <= totalLines); // 过滤掉超过总行数的标签行
  
  if (labeledLines.length === 0) {
    return labels;
  }
  
  let currentName = lineToSemanticMap.get(labeledLines[0])!;
  let startLine = Number(labeledLines[0]);
  
  for (let i = 1; i < labeledLines.length; i++) {
    const currentLabeledLine = labeledLines[i];
    const endLine = currentLabeledLine - 1;
    const nextName = lineToSemanticMap.get(currentLabeledLine)!;
    
    // 确保结束行不小于开始行
    if (endLine >= startLine && currentName !== nextName) {
      labels.push({
        name: currentName,
        startLine: startLine,
        endLine: endLine
      });
      startLine = Number(currentLabeledLine);
    }
    
    currentName = nextName;
  }
  
  // 最后一个范围结束于总行数
  if (startLine <= totalLines) {
    labels.push({
      name: currentName,
      startLine: startLine,
      endLine: totalLines
    });
  }
  
  return labels;
}