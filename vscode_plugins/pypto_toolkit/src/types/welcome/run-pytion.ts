import { ExecException } from 'child_process';

// 定义输出结果的结构化类型
export interface PythonExecuteResult {
  success: boolean; // 是否执行成功
  stdout: string; // 标准输出
  stderr: string; // 错误输出
  error?: ExecException; // 执行异常（失败时存在）
}
