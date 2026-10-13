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
import type { ChipConfig, ChipConfigValidationResult, ChipNode } from './chip-config.types';

const SUPPORTED_SCHEMA_VERSIONS = new Set(['1.0']);

const addNodeHandles = (handleMap: Map<string, Set<string>>, node: ChipNode): void => {
  handleMap.set(node.id, new Set((node.handles || []).map(handle => handle.id)));
  (node.splitChildren || []).forEach(child => {
    handleMap.set(child.id, new Set((child.handles || []).map(handle => handle.id)));
  });
};

const checkStyleToken = (styleToken: string | undefined, entityId: string, knownStyleTokens: Set<string>, warnings: string[], prefix: string): void => {
  if (styleToken && !knownStyleTokens.has(styleToken)) {
    warnings.push(`Unknown ${prefix} style token '${styleToken}' on ${prefix} '${entityId}'`);
  }
};

const checkDuplicateId = (id: string, nodeIds: Set<string>, splitNodeIds: Set<string>, errors: string[], label: string): boolean => {
  if (nodeIds.has(id) || splitNodeIds.has(id)) {
    errors.push(`Duplicate ${label} id: ${id}`);
    return true;
  }
  return false;
};

const validateSchemaAndChip = (config: ChipConfig, errors: string[]): void => {
  if (!SUPPORTED_SCHEMA_VERSIONS.has(config.schemaVersion)) {
    errors.push(`Unsupported chip config schemaVersion: ${config.schemaVersion}`);
  }
  if (!config.chip?.arch) {
    errors.push('Missing chip.arch');
  }
  if (!config.chip?.displayName) {
    errors.push('Missing chip.displayName');
  }
};

const validateNodes = (config: ChipConfig, knownStyleTokens: Set<string>, errors: string[], warnings: string[]): { nodeIds: Set<string>, splitNodeIds: Set<string>, handleMap: Map<string, Set<string>> } => {
  const nodeIds = new Set<string>();
  const splitNodeIds = new Set<string>();
  const handleMap = new Map<string, Set<string>>();

  for (const node of config.nodes || []) {
    if (!checkDuplicateId(node.id, nodeIds, splitNodeIds, errors, 'node')) {
      nodeIds.add(node.id);
      addNodeHandles(handleMap, node);
      checkStyleToken(node.styleToken, node.id, knownStyleTokens, warnings, 'node');

      for (const child of node.splitChildren || []) {
        if (!checkDuplicateId(child.id, nodeIds, splitNodeIds, errors, 'split node')) {
          splitNodeIds.add(child.id);
          checkStyleToken(child.styleToken, child.id, knownStyleTokens, warnings, 'split node');
        }
      }
    }
  }

  return { nodeIds, splitNodeIds, handleMap };
};

const validateParentReferences = (config: ChipConfig, nodeIds: Set<string>, errors: string[]): void => {
  for (const node of config.nodes || []) {
    if (node.parentId && !nodeIds.has(node.parentId)) {
      errors.push(`Node '${node.id}' references missing parent '${node.parentId}'`);
    }
  }
};

const validateEdges = (config: ChipConfig, nodeIds: Set<string>, handleMap: Map<string, Set<string>>, knownStyleTokens: Set<string>, errors: string[], warnings: string[]): void => {
  for (const edge of config.edges || []) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge '${edge.id}' references missing source node '${edge.source}'`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge '${edge.id}' references missing target node '${edge.target}'`);
    }

    const sourceHandles = handleMap.get(edge.source);
    if (edge.sourceHandle && sourceHandles && !sourceHandles.has(edge.sourceHandle)) {
      errors.push(`Edge '${edge.id}' references missing source handle '${edge.sourceHandle}' on '${edge.source}'`);
    }

    const targetHandles = handleMap.get(edge.target);
    if (edge.targetHandle && targetHandles && !targetHandles.has(edge.targetHandle)) {
      errors.push(`Edge '${edge.id}' references missing target handle '${edge.targetHandle}' on '${edge.target}'`);
    }

    checkStyleToken(edge.styleToken, edge.id, knownStyleTokens, warnings, 'edge');
  }
};

const validateMemoryConfig = (config: ChipConfig, nodeIds: Set<string>, splitNodeIds: Set<string>, errors: string[]): void => {
  for (const [memType, target] of Object.entries(config.memoryTypeMap || {})) {
    if (!nodeIds.has(target) && !splitNodeIds.has(target)) {
      errors.push(`memoryTypeMap entry '${memType}' references missing node '${target}'`);
    }
  }

  for (const [memType, capacity] of Object.entries(config.memoryCapacityBytes || {})) {
    if (typeof capacity !== 'number' || Number.isNaN(capacity)) {
      errors.push(`memoryCapacityBytes entry '${memType}' must be a number`);
    }
  }
};

export const validateChipConfig = (config: ChipConfig, knownStyleTokens: Set<string>): ChipConfigValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  validateSchemaAndChip(config, errors);
  const { nodeIds, splitNodeIds, handleMap } = validateNodes(config, knownStyleTokens, errors, warnings);
  validateParentReferences(config, nodeIds, errors);
  validateEdges(config, nodeIds, handleMap, knownStyleTokens, errors, warnings);
  validateMemoryConfig(config, nodeIds, splitNodeIds, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
