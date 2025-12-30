import * as vscode from 'vscode';
import { t as _ } from 'i18next';

export class PyptoJitCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        if (document.languageId !== 'python') {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        // Cache string ranges once per document for efficiency
        const stringRanges = this.findStringRanges(text);

        // 使用更精确的识别逻辑，排除注释和字符串中的装饰器
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // 跳过空行和注释
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }
            
            // 检查是否是真实的@pypto.jit装饰器
            if (this.isRealPyptoJitDecorator(text, i, stringRanges, lines)) {
                // 创建四个CodeLens按钮 - 按钮名称保持固定，不随状态变化
                codeLenses.push(new vscode.CodeLens(
                    new vscode.Range(i, 0, i, line.length),
                    {
                        title: _('pypto.setDebugMode'),
                        command: "pypto.setDebugOptions",
                        arguments: [document.uri, i]
                    }
                ));

                codeLenses.push(new vscode.CodeLens(
                    new vscode.Range(i, 0, i, line.length),
                    {
                        title: _('pypto.cancelDebugMode'),
                        command: "pypto.unsetDebugOptions",
                        arguments: [document.uri, i]
                    }
                ));

                codeLenses.push(new vscode.CodeLens(
                    new vscode.Range(i, 0, i, line.length),
                    {
                        title: _('pypto.setAllDebugMode'),
                        command: "pypto.setAllDebugMode",
                        arguments: [document.uri]
                    }
                ));

                codeLenses.push(new vscode.CodeLens(
                    new vscode.Range(i, 0, i, line.length),
                    {
                        title: _('pypto.cancelAllDebugMode'),
                        command: "pypto.unsetAllDebugMode",
                        arguments: [document.uri]
                    }
                ));
            }
        }

        return codeLenses;
    }

    /**
     * 检查指定行是否是真实的@pypto.jit装饰器（不在注释或字符串中）
     */
    private isRealPyptoJitDecorator(text: string, lineNumber: number, stringRanges: {start: number, end: number}[], lines: string[]): boolean {
        const line = lines[lineNumber];
        const trimmedLine = line.trim();
        
        // 基本格式检查 - 允许单行和多行装饰器
        // 对于多行装饰器，第一行以@pypto.jit开头但括号可能没有闭合
        if (!trimmedLine.match(/^@pypto\.jit(\([^)]*$)?$/) && 
            !trimmedLine.match(/^@pypto\.jit(\(.*\))?$/)) {
            return false;
        }
        
        // 检查是否在字符串中（使用已缓存的stringRanges）
        if (this.isInString(text, lineNumber, stringRanges, lines)) {
            return false;
        }
        
        // 额外检查：确保不是在注释中
        if (this.isInComment(line, trimmedLine.indexOf('@pypto.jit'))) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 检查指定位置是否在注释中
     */
    private isInComment(line: string, pyptoJitIndex: number): boolean {
        // 检查在@pypto.jit之前是否有#字符（不在字符串中）
        let inString = false;
        let stringChar: string | null = null;
        
        for (let i = 0; i < pyptoJitIndex; i++) {
            const char = line[i];
            
            if (!inString && (char === '"' || char === "'")) {
                inString = true;
                stringChar = char;
            } else if (inString && char === stringChar) {
                // 检查是否转义字符
                if (i > 0 && line[i-1] === '\\') {
                    continue;
                }
                inString = false;
                stringChar = null;
            } else if (!inString && char === '#') {
                // 找到不在字符串中的#，说明@pypto.jit在注释中
                return true;
            }
        }
        
        return false;
    }

    /**
     * 检查指定行是否在字符串中（合并了多行和单行字符串检查）
     */
    private isInString(text: string, lineNumber: number, stringRanges: {start: number, end: number}[], lines: string[]): boolean {
        const line = lines[lineNumber];
        
        // 如果行中没有@pypto.jit，直接返回false
        if (!line.includes('@pypto.jit')) return false;
        
        // 获取当前行的范围
        const lineStart = this.getLineStartPosition(text, lineNumber, lines);
        
        // 检查当前行的@pypto.jit是否在任何字符串范围内
        const pyptoJitIndex = line.indexOf('@pypto.jit');
        if (pyptoJitIndex === -1) return false;
        
        const pyptoJitGlobalPos = lineStart + pyptoJitIndex;
        
        // 使用二分查找来检查位置是否在字符串范围内，提高性能
        return this.isPositionInStringRanges(pyptoJitGlobalPos, stringRanges);
    }
    
    /**
     * 使用二分查找来高效检查位置是否在任何字符串范围内
     */
    private isPositionInStringRanges(position: number, ranges: {start: number, end: number}[]): boolean {
        // 首先确保ranges是按start位置排序的
        const sortedRanges = ranges.sort((a, b) => a.start - b.start);
        
        let left = 0;
        let right = sortedRanges.length - 1;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const range = sortedRanges[mid];
            
            if (position >= range.start && position <= range.end) {
                return true;
            } else if (position < range.start) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }
        
        return false;
    }
    
    /**
     * 查找文档中所有字符串的范围（优化版本）
     */
    private findStringRanges(text: string): {start: number, end: number}[] {
        const ranges: {start: number, end: number}[] = [];
        let inString = false;
        let stringChar: string | null = null;
        let stringStart = 0;
        let i = 0;
        const len = text.length;
        
        while (i < len) {
            const char = text[i];
            
            // 处理多行字符串
            if (!inString && i <= len - 3) {
                const threeChars = text.substring(i, i + 3);
                if (threeChars === '"""' || threeChars === "'''") {
                    // 检查是否是转义的三个引号（如\"\"\"）
                    if (i > 0 && text[i-1] === '\\') {
                        i++;
                        continue;
                    }
                    // 多行字符串开始
                    inString = true;
                    stringChar = threeChars;
                    stringStart = i;
                    i += 3;
                    continue;
                }
            } else if (inString && i <= len - 3) {
                const threeChars = text.substring(i, i + 3);
                if (threeChars === stringChar) {
                    // 检查是否是转义的三个引号
                    if (i > 0 && text[i-1] === '\\') {
                        i++;
                        continue;
                    }
                    // 多行字符串结束
                    inString = false;
                    stringChar = null;
                    ranges.push({start: stringStart, end: i + 3});
                    i += 3;
                    continue;
                }
            }
            
            // 处理单行字符串
            if (!inString && (char === '"' || char === "'")) {
                // 单行字符串开始
                inString = true;
                stringChar = char;
                stringStart = i;
            } else if (inString && char === stringChar) {
                // 检查是否转义字符
                if (i > 0 && text[i-1] === '\\') {
                    i++;
                    continue;
                }
                
                // 单行字符串结束
                inString = false;
                stringChar = null;
                ranges.push({start: stringStart, end: i + 1});
            }
            
            i++;
        }
        
        return ranges;
    }
    
    /**
     * 获取指定行的起始位置（在文档中的全局位置）
     */
    private getLineStartPosition(text: string, lineNumber: number, lines?: string[]): number {
        // 如果没有传入lines，则创建一个（向后兼容）
        if (!lines) {
            lines = text.split('\n');
        }
        
        // 使用reduce来计算位置，更高效
        return lines.slice(0, lineNumber).reduce((pos, line) => pos + line.length + 1, 0);
    }

    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }
}
