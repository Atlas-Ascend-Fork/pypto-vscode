import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { IGmMemoryVisualApis, IGmMemoryVisualRefs, IGmMemoryVisualServer } from './view-server-interface';
import * as vscode from 'vscode';

@viewRefs([
  'GmMemoryVisualData',
])
export class GmMemoryVisualServer extends ViewServer<IGmMemoryVisualApis, IGmMemoryVisualRefs> implements IGmMemoryVisualServer {
  query?: any;

  constructor(ctx: ViewServerContext) {
    super(ctx);
    this.query = typeof ctx.fileUri?.query === 'string' ? this.safeParse(ctx.fileUri?.query) : (ctx.fileUri?.query ?? {});
  }
  setSaveDir: () => Promise<void>;
  checkSys: () => Promise<void>;
  saveFile: (message: { dataUrl: any; fileName?: any; filePath?: any }) => Promise<void>;
  checkFilePath: (message: { filePath: any }) => Promise<void>;
  public override created(ctx: ViewServerContext): void {
    this.getGmMemoryVisualData();
  }

  @viewApi()
  public getGmMemoryVisualData = async () => {
    let fsPath = this.query?._path ?? '';
    const memoryData = await parseJson(fsPath);
    this.setRef('GmMemoryVisualData', memoryData);
  };

  safeParse(str: string) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}


export async function parseJson(fsPath : string):Promise<any>{
  if (!fsPath) {
      console.error('文件路径为空');
      return;
    }
    try {
      const fileUri = vscode.Uri.file(fsPath);
      const fileData = await vscode.workspace.fs.readFile(fileUri);
      const fileContent = Buffer.from(fileData).toString('utf8');
      const jsonData = JSON.parse(fileContent);
      console.log('成功读取 JSON 数据:', jsonData);
      // 将解析后的数据返回给调用方
      return jsonData;
    } catch (error: any) {
      console.error('读取或解析 JSON 文件失败:', error);
      vscode.window.showErrorMessage(`读取文件失败: ${error.message}`);
    }
}