import type { ChipConfig, ChipConfigValidationResult, ChipNode } from './chip-config.types';

const SUPPORTED_SCHEMA_VERSIONS = new Set(['1.0']);

const addNodeHandles = (handleMap: Map<string, Set<string>>, node: ChipNode): void => {
  handleMap.set(node.id, new Set((node.handles || []).map(handle => handle.id)));
  (node.splitChildren || []).forEach(child => {
    handleMap.set(child.id, new Set((child.handles || []).map(handle => handle.id)));
  });
};

export const validateChipConfig = (config: ChipConfig, knownStyleTokens: Set<string>): ChipConfigValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!SUPPORTED_SCHEMA_VERSIONS.has(config.schemaVersion)) {
    errors.push(`Unsupported chip config schemaVersion: ${config.schemaVersion}`);
  }

  if (!config.chip?.arch) {
    errors.push('Missing chip.arch');
  }

  if (!config.chip?.displayName) {
    errors.push('Missing chip.displayName');
  }

  const nodeIds = new Set<string>();
  const splitNodeIds = new Set<string>();
  const handleMap = new Map<string, Set<string>>();

  for (const node of config.nodes || []) {
    if (nodeIds.has(node.id) || splitNodeIds.has(node.id)) {
      errors.push(`Duplicate node id: ${node.id}`);
    }
    nodeIds.add(node.id);
    addNodeHandles(handleMap, node);

    if (node.styleToken && !knownStyleTokens.has(node.styleToken)) {
      warnings.push(`Unknown node style token '${node.styleToken}' on node '${node.id}'`);
    }

    for (const child of node.splitChildren || []) {
      if (nodeIds.has(child.id) || splitNodeIds.has(child.id)) {
        errors.push(`Duplicate split node id: ${child.id}`);
      }
      splitNodeIds.add(child.id);

      if (child.styleToken && !knownStyleTokens.has(child.styleToken)) {
        warnings.push(`Unknown split node style token '${child.styleToken}' on node '${child.id}'`);
      }
    }
  }

  for (const node of config.nodes || []) {
    if (node.parentId && !nodeIds.has(node.parentId)) {
      errors.push(`Node '${node.id}' references missing parent '${node.parentId}'`);
    }
  }

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

    if (edge.styleToken && !knownStyleTokens.has(edge.styleToken)) {
      warnings.push(`Unknown edge style token '${edge.styleToken}' on edge '${edge.id}'`);
    }
  }

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

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
