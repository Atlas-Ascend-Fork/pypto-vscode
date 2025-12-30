import * as vscode from 'vscode';
import * as fs from 'fs';

interface MultilineDecoratorInfo {
    text: string;
    range: vscode.Range;
}

export class PyptoJitService {
    /**
     * 转换装饰器文本，添加或更新debug_options参数
     * @param decoratorText 装饰器文本
     * @param enableDebug 是否启用调试模式
     * @returns 转换后的装饰器文本
     */
    private static transformDecoratorText(decoratorText: string, enableDebug: boolean): string {
        const debugModeValue = enableDebug ? '1' : '0';
        // 注意：逗号后添加空格
        const debugOptions = `debug_options=dict(compile_debug_mode=${debugModeValue}, runtime_debug_mode=${debugModeValue})`;
        
        // 处理可能的缩进
        const trimmedText = decoratorText.trim();
        const indentation = decoratorText.substring(0, decoratorText.indexOf('@pypto.jit'));
        
        if (trimmedText === '@pypto.jit') {
            // 简单的@pypto.jit装饰器
            return indentation + trimmedText.replace('@pypto.jit', `@pypto.jit(${debugOptions})`);
        } else if (trimmedText.match(/^@pypto\.jit\(/)) {
            // 已经有参数的@pypto.jit装饰器
            if (trimmedText.includes('debug_options')) {
                // 更新现有的debug_options
                const updatedText = trimmedText.replace(
                    /debug_options\s*=\s*dict\([^)]*\)/,
                    debugOptions
                );
                return indentation + updatedText;
            } else {
                // 检查是否是空括号@pypto.jit()
                const emptyBracketsMatch = trimmedText.match(/^@pypto\.jit\(\s*\)$/);
                if (emptyBracketsMatch) {
                    // 空括号，直接添加debug_options
                    const updatedText = trimmedText.replace(
                        /@pypto\.jit\(\s*\)/,
                        `@pypto.jit(${debugOptions})`
                    );
                    return indentation + updatedText;
                } else {
                    // 有其他参数，添加debug_options（注意逗号后有空格）
                    const updatedText = trimmedText.replace(
                        /@pypto\.jit\(([^)]*)\)/,
                        `@pypto.jit($1, ${debugOptions})`
                    );
                    return indentation + updatedText;
                }
            }
        } else {
            throw new Error('无法识别的@pypto.jit装饰器格式');
        }
    }

    /**
     * 为指定行的@pypto.jit装饰器设置或更新调试选项为调试模式
     * @param documentUri 文档URI
     * @param lineNumber 装饰器所在行号
     */
    public static async setDebugOptions(documentUri: vscode.Uri, lineNumber: number): Promise<void> {
        const document = await vscode.workspace.openTextDocument(documentUri);
        const text = document.getText();
        const lines = text.split('\n');
        
        if (lineNumber < 0 || lineNumber >= lines.length) {
            vscode.window.showErrorMessage('无效的行号');
            return;
        }

        const line = lines[lineNumber];
        
        // 检查是否是@pypto.jit装饰器
        if (!line.trim().startsWith('@pypto.jit')) {
            vscode.window.showErrorMessage('所选行不是@pypto.jit装饰器');
            return;
        }

        // 检查是否是多行装饰器
        const isMultiline = this.isMultilineDecorator(lines, lineNumber);
        
        let decoratorText: string;
        let decoratorRange: vscode.Range;
        
        if (isMultiline) {
            // 获取完整的多行装饰器文本和范围
            const result = this.getMultilineDecoratorInfo(document, lineNumber);
            decoratorText = result.text;
            decoratorRange = result.range;
        } else {
            // 单行装饰器
            decoratorText = line;
            decoratorRange = document.lineAt(lineNumber).range;
        }

        // 构建新的装饰器文本，处理已有debug_options的情况
        let newDecoratorText: string;
        try {
            newDecoratorText = this.transformDecoratorText(decoratorText, true);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(errorMessage);
            return;
        }

        // 应用修改
        const edit = new vscode.WorkspaceEdit();
        edit.replace(documentUri, decoratorRange, newDecoratorText);
        
        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            vscode.window.showInformationMessage('已成功设置调试模式');
        } else {
            vscode.window.showErrorMessage('设置调试模式失败');
        }
    }

    /**
     * 检查是否是多行装饰器
     */
    private static isMultilineDecorator(lines: string[], lineNumber: number): boolean {
        const line = lines[lineNumber];
        const trimmedLine = line.trim();
        
        // 如果不是以@pypto.jit开头，不是装饰器
        if (!trimmedLine.startsWith('@pypto.jit')) {
            return false;
        }
        
        // 如果是@pypto.jit但没有括号，不是多行
        if (trimmedLine === '@pypto.jit') {
            return false;
        }
        
        // 如果是@pypto.jit()，不是多行
        if (trimmedLine === '@pypto.jit()') {
            return false;
        }
        
        // 如果是@pypto.jit(...)并且括号闭合，不是多行
        const match = trimmedLine.match(/^@pypto\.jit\((.*)\)$/);
        if (match) {
            return false;
        }
        
        // 否则可能是多行装饰器
        return true;
    }

    /**
     * 获取多行装饰器的完整文本和范围
     */
    private static getMultilineDecoratorInfo(document: vscode.TextDocument, startLine: number): MultilineDecoratorInfo {
        const lines = document.getText().split('\n');
        const totalLines = lines.length;
        
        // 从起始行开始，找到装饰器的结束行
        let endLine = startLine;
        let openParenCount = 0;
        let inString = false;
        let stringChar: string | null = null;
        
        for (let i = startLine; i < totalLines; i++) {
            const line = lines[i];
            
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                
                // 处理字符串状态
                if (!inString && (char === '"' || char === "'")) {
                    inString = true;
                    stringChar = char;
                } else if (inString && char === stringChar) {
                    // 检查是否转义字符
                    if (j > 0 && line[j-1] === '\\') {
                        continue;
                    }
                    inString = false;
                    stringChar = null;
                }
                
                // 如果在字符串中，跳过括号计数
                if (inString) continue;
                
                // 计算括号
                if (char === '(') {
                    openParenCount++;
                } else if (char === ')') {
                    openParenCount--;
                }
            }
            
            // 如果括号已经闭合，则结束行是当前行
            if (openParenCount === 0 && i > startLine) {
                endLine = i;
                break;
            }
            
            // 如果到了文件末尾还没闭合，结束行是最后一行
            if (i === totalLines - 1) {
                endLine = i;
                break;
            }
        }
        
        // 构建装饰器文本
        const decoratorText = lines.slice(startLine, endLine + 1).join('\n');
        
        // 构建范围
        const startPos = new vscode.Position(startLine, 0);
        const endPos = new vscode.Position(endLine, lines[endLine].length);
        const range = new vscode.Range(startPos, endPos);
        
        return {
            text: decoratorText,
            range: range
        };
    }

    /**
     * 为指定行的@pypto.jit装饰器取消调试模式
     * @param documentUri 文档URI
     * @param lineNumber 装饰器所在行号
     */
    public static async unsetDebugOptions(documentUri: vscode.Uri, lineNumber: number): Promise<void> {
        const document = await vscode.workspace.openTextDocument(documentUri);
        const text = document.getText();
        const lines = text.split('\n');
        
        if (lineNumber < 0 || lineNumber >= lines.length) {
            vscode.window.showErrorMessage('无效的行号');
            return;
        }

        const line = lines[lineNumber];
        
        // 检查是否是@pypto.jit装饰器
        if (!line.trim().startsWith('@pypto.jit')) {
            vscode.window.showErrorMessage('所选行不是@pypto.jit装饰器');
            return;
        }

        // 检查是否是多行装饰器
        const isMultiline = this.isMultilineDecorator(lines, lineNumber);
        
        let decoratorText: string;
        let decoratorRange: vscode.Range;
        
        if (isMultiline) {
            // 获取完整的多行装饰器文本和范围
            const result = this.getMultilineDecoratorInfo(document, lineNumber);
            decoratorText = result.text;
            decoratorRange = result.range;
        } else {
            // 单行装饰器
            decoratorText = line;
            decoratorRange = document.lineAt(lineNumber).range;
        }

        // 构建新的装饰器文本，更新debug_options
        let newDecoratorText: string;
        
        // 检查是否有debug_options参数
        if (!decoratorText.includes('debug_options')) {
            vscode.window.showInformationMessage('该装饰器没有debug_options参数，无需取消');
            return;
        }
        
        try {
            newDecoratorText = this.transformDecoratorText(decoratorText, false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(errorMessage);
            return;
        }

        // 应用修改
        const edit = new vscode.WorkspaceEdit();
        edit.replace(documentUri, decoratorRange, newDecoratorText);
        
        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            vscode.window.showInformationMessage('已成功取消调试模式');
        } else {
            vscode.window.showErrorMessage('取消调试模式失败');
        }
    }

    /**
     * 为文档中所有@pypto.jit装饰器设置调试模式
     * @param documentUri 文档URI
     */
    public static async setAllDebugMode(documentUri: vscode.Uri): Promise<void> {
        const document = await vscode.workspace.openTextDocument(documentUri);
        const text = document.getText();
        const lines = text.split('\n');
        
        const edits: vscode.TextEdit[] = [];
        let modifiedCount = 0;
        let processedLines: Set<number> = new Set();
        
        // 预先计算所有字符串范围，提高性能
        const stringRanges = this.findStringRanges(text);

        for (let i = 0; i < lines.length; i++) {
            // 跳过已处理的行（处理多行装饰器时使用）
            if (processedLines.has(i)) {
                continue;
            }
            
            const line = lines[i];
            
            // 检查是否是@pypto.jit装饰器
            if (line.trim().startsWith('@pypto.jit')) {
                // 检查是否在字符串中（重要：避免修改字符串中的装饰器）
                if (this.isInString(text, i, stringRanges, lines)) {
                    continue;
                }
                
                // 检查是否在注释中
                if (this.isInComment(line, line.indexOf('@pypto.jit'))) {
                    continue;
                }
                
                // 检查是否是多行装饰器
                const isMultiline = this.isMultilineDecorator(lines, i);
                
                let decoratorText: string;
                let decoratorRange: vscode.Range;
                
                if (isMultiline) {
                    // 获取完整的多行装饰器文本和范围
                    const result = this.getMultilineDecoratorInfo(document, i);
                    decoratorText = result.text;
                    decoratorRange = result.range;
                    
                    // 标记所有相关行已处理
                    const startLine = result.range.start.line;
                    const endLine = result.range.end.line;
                    for (let j = startLine; j <= endLine; j++) {
                        processedLines.add(j);
                    }
                } else {
                    // 单行装饰器
                    decoratorText = line;
                    decoratorRange = document.lineAt(i).range;
                    processedLines.add(i);
                }
                
                // 构建新的装饰器文本
                let newDecoratorText: string;
                try {
                    newDecoratorText = this.transformDecoratorText(decoratorText, true);
                } catch (error) {
                    continue; // 跳过无法识别的格式
                }

                // 创建编辑操作
                edits.push(new vscode.TextEdit(decoratorRange, newDecoratorText));
                modifiedCount++;
            }
        }

        if (modifiedCount === 0) {
            vscode.window.showInformationMessage('没有找到需要修改的@pypto.jit装饰器');
            return;
        }

        // 应用所有修改
        const edit = new vscode.WorkspaceEdit();
        edits.forEach(e => edit.replace(documentUri, e.range, e.newText));
        
        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            vscode.window.showInformationMessage(`已成功为${modifiedCount}个装饰器设置调试模式`);
        } else {
            vscode.window.showErrorMessage('批量设置调试模式失败');
        }
    }

    /**
     * 为文档中所有@pypto.jit装饰器取消调试模式
     * @param documentUri 文档URI
     */
    public static async unsetAllDebugMode(documentUri: vscode.Uri): Promise<void> {
        const document = await vscode.workspace.openTextDocument(documentUri);
        const text = document.getText();
        const lines = text.split('\n');
        
        const edits: vscode.TextEdit[] = [];
        let modifiedCount = 0;
        let processedLines: Set<number> = new Set();
        
        // 预先计算所有字符串范围，提高性能
        const stringRanges = this.findStringRanges(text);

        for (let i = 0; i < lines.length; i++) {
            // 跳过已处理的行（处理多行装饰器时使用）
            if (processedLines.has(i)) {
                continue;
            }
            
            const line = lines[i];
            
            // 检查是否是@pypto.jit装饰器且有debug_options参数
            if (line.trim().startsWith('@pypto.jit')) {
                // 检查是否在字符串中（重要：避免修改字符串中的装饰器）
                if (this.isInString(text, i, stringRanges, lines)) {
                    continue;
                }
                
                // 检查是否在注释中
                if (this.isInComment(line, line.indexOf('@pypto.jit'))) {
                    continue;
                }
                
                // 检查是否是多行装饰器
                const isMultiline = this.isMultilineDecorator(lines, i);
                
                let decoratorText: string;
                let decoratorRange: vscode.Range;
                
                if (isMultiline) {
                    // 获取完整的多行装饰器文本和范围
                    const result = this.getMultilineDecoratorInfo(document, i);
                    decoratorText = result.text;
                    decoratorRange = result.range;
                    
                    // 标记所有相关行已处理
                    const startLine = result.range.start.line;
                    const endLine = result.range.end.line;
                    for (let j = startLine; j <= endLine; j++) {
                        processedLines.add(j);
                    }
                } else {
                    // 单行装饰器
                    decoratorText = line;
                    decoratorRange = document.lineAt(i).range;
                    processedLines.add(i);
                }
                
                // 只处理有debug_options参数的装饰器
                if (decoratorText.includes('debug_options')) {
                    try {
                        // 使用辅助方法更新debug_options
                        const newDecoratorText = this.transformDecoratorText(decoratorText, false);
                        
                        // 创建编辑操作
                        edits.push(new vscode.TextEdit(decoratorRange, newDecoratorText));
                        modifiedCount++;
                    } catch (error) {
                        // 跳过无法识别的格式
                        continue;
                    }
                }
            }
        }

        if (modifiedCount === 0) {
            vscode.window.showInformationMessage('没有找到需要取消调试模式的@pypto.jit装饰器');
            return;
        }

        // 应用所有修改
        const edit = new vscode.WorkspaceEdit();
        edits.forEach(e => edit.replace(documentUri, e.range, e.newText));
        
        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            vscode.window.showInformationMessage(`已成功为${modifiedCount}个装饰器取消调试模式`);
        } else {
            vscode.window.showErrorMessage('批量取消调试模式失败');
        }
    }
    
    /**
     * 检查指定行是否在字符串中
     */
    private static isInString(text: string, lineNumber: number, stringRanges: {start: number, end: number}[], lines: string[]): boolean {
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
    private static isPositionInStringRanges(position: number, ranges: {start: number, end: number}[]): boolean {
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
     * 查找文档中所有字符串的范围
     */
    private static findStringRanges(text: string): {start: number, end: number}[] {
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
     * 检查指定位置是否在注释中
     */
    private static isInComment(line: string, pyptoJitIndex: number): boolean {
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
     * 获取指定行的起始位置（在文档中的全局位置）
     */
    private static getLineStartPosition(text: string, lineNumber: number, lines: string[]): number {
        // 使用reduce来计算位置，更高效
        return lines.slice(0, lineNumber).reduce((pos, line) => pos + line.length + 1, 0);
    }
}
