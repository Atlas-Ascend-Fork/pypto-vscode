export const lineToSemanticMap = new Map<number, string>();
export let labels: SemanticRange[] = [];

export function mkSemanticLabel(jsonData: any, filePath: string) {
  lineToSemanticMap.clear();
  if (jsonData.functions && Array.isArray(jsonData.functions)) {
    jsonData.functions.forEach((func: any) => {
      if (func.operations && Array.isArray(func.operations)) {
        func.operations.forEach((op: any) => {
          if (op.file && op.file === filePath) {
            const line = op.line;
            const semanticLabels = op.semantic_label || [];
            
            const validLabel = semanticLabels.find(label => label && label.trim() !== '');
            
            if (validLabel) {
              if (!lineToSemanticMap.has(line)) {
                lineToSemanticMap.set(line, validLabel);
              }
            }
          }
        });
      }
    });
  }
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
  let startLine = labeledLines[0];
  
  for (let i = 1; i < labeledLines.length; i++) {
    const currentLabeledLine = labeledLines[i];
    const endLine = currentLabeledLine - 1;
    
    // 确保结束行不小于开始行
    if (endLine >= startLine) {
      labels.push({
        name: currentName,
        startLine: startLine,
        endLine: endLine
      });
    }
    
    currentName = lineToSemanticMap.get(currentLabeledLine)!;
    startLine = currentLabeledLine;
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