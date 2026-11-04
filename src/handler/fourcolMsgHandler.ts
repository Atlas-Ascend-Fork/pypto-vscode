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
import {
  getOpsByPyInfo as queryOpsByPyInfo,
  getPyFileList as queryPyFileList,
  getPyLocationByOps as queryPyLocationByOps,
  isProgramLoaded,
  OpByPyInfo,
  PyFileItem,
  PyLocation,
  toProgramId,
} from '../services/fourcol';

/**
 * 四联动索引查询的消息处理（@viewApi 薄委托，逻辑在本层）。
 * 应答走直接返回值通道（requestId 由基础设施自动关联，前端 await 即得）。
 * 未加载/无 comPath 时统一返回 null，绝不自动触发 load（见 ADR 0002）。
 */
export class FourcolMsgHandler {
  private static async resolveProgramId(server: any): Promise<string | null> {
    if (!server.comPath) {
      return null;
    }
    const programId = toProgramId(server.comPath);
    return (await isProgramLoaded(programId)) ? programId : null;
  }

  /** 按 py 文件 + 行号查 (hash, opmagic) 对；入参 message.paramObj: { pyFile, pyLine } */
  static async getOpsByPyInfo(server: any, message: any): Promise<OpByPyInfo[] | null> {
    const { pyFile, pyLine } = message?.paramObj ?? {};
    const programId = await this.resolveProgramId(server);
    if (!programId || !pyFile || pyLine == null) {
      return null;
    }
    return queryOpsByPyInfo(programId, pyFile, pyLine);
  }

  /** 按 (hash, opmagic) 索引数组反查 py 落点；入参 message.paramObj 即 pairs 数组，出参索引对齐 */
  static async getPyLocationByOps(server: any, message: any): Promise<(PyLocation | null)[] | null> {
    const pairs = message?.paramObj;
    const programId = await this.resolveProgramId(server);
    if (!programId || !Array.isArray(pairs)) {
      return null;
    }
    return queryPyLocationByOps(programId, pairs);
  }

  /** 计算图全部 py 文件及存在性 */
  static async getPyFileList(server: any): Promise<PyFileItem[] | null> {
    const programId = await this.resolveProgramId(server);
    if (!programId) {
      return null;
    }
    return queryPyFileList(programId);
  }
}
