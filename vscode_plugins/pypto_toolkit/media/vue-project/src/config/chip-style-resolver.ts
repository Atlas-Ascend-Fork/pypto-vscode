import type { ChipEdge, ChipNode } from './chip-config.types';

export interface ResolvedNodeStyle {
  data: Record<string, any>;
}

export interface ResolvedEdgeStyle {
  data: Record<string, any>;
  style: Record<string, any>;
}

const labelStyle = {
  color: 'var(--pto-font-color-title)',
};

const squareMemoryStyle = {
  emptyColor: 'var(--ma-square)',
  filledColor: '#5ea3ef',
  bgColor: 'var(--ma-L1-square-bg)',
};

const nodeTokenMap: Record<string, ResolvedNodeStyle> = {
  'memory.gm': {
    data: {
      bgColor: 'var(--ma-Gm-bg)',
      emptyColor: 'var(--ma-Gm-cell)',
      layoutStyles: {
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        padding: 0,
      },
      gridSectionStyle: { padding: '1px ', border: '1px solid rgba(255, 255, 255, 0.3)' },
      badgeStyle: {
        backgroundColor: 'transparent',
        flexDirection: 'column',
      },
    },
  },
  'memory.l2': {
    data: {
      bgColor: 'var(--ma-L2-BG)',
      emptyColor: 'var(--ma-L2-cell)',
      filledColor: 'rgba(83, 85, 97, 1)',
      layoutStyles: {
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        padding: 0,
      },
      gridSectionStyle: { height: '100%', display: 'flex', alignItems: 'center', border: 'none' },
      badgeStyle: {
        backgroundColor: 'transparent',
        flexDirection: 'column',
      },
      speed: 1000,
    },
  },
  'memory.l1': { data: squareMemoryStyle },
  'memory.l0': { data: squareMemoryStyle },
  'memory.ub': { data: squareMemoryStyle },
  'memory.cache': {
    data: {
      emptyColor: 'var(--ma-square)',
      filledColor: '#9ca3af',
      bgColor: 'var(--ma-DCache-bg)',
    },
  },
  'memory.scalar': {
    data: {
      emptyColor: 'var(--ma-Scalar-bg)',
      filledColor: 'var(--ma-Scalar-bg)',
      bgColor: 'var(--ma-Scalar-bg)',
      showHeader: false,
      centerIcon: true,
      badgeStyle: {
        backgroundColor: 'transparent',
      },
    },
  },
  'container.core': {
    data: {
      bgColor: 'var(--ma-box-bg)',
      borderColor: 'var(--ma-box-bg)',
      glowColor: 'var(--ma-box-bg)',
      fontSize: 16,
      labelX: 15,
      labelY: 10,
      labelStyle,
    },
  },
  'compute.cube': {
    data: {
      fontSize: 22,
      labelStyle,
    },
  },
  'compute.vector': {
    data: {
      labelStyle,
    },
  },
  'pipe.fixpipe': {
    data: {},
  },
};

const edgeDefaults = {
  labelBgColor: 'var(--ma-MTE-bg)',
  labelTextColor: '#ffffff',
  showCircle: false,
};

export const edgeTokenMap: Record<string, ResolvedEdgeStyle> = {
  'pipe.mte': {
    data: edgeDefaults,
    style: { stroke: 'var(--ma-MTE-bg)', strokeWidth: 2 },
  },
  'pipe.fixpipe': {
    data: edgeDefaults,
    style: { stroke: 'var(--ma-MTE-bg)', strokeWidth: 2 },
  },
  'pipe.compute': {
    data: edgeDefaults,
    style: { stroke: 'var(--ma-arrow)', strokeWidth: 2 },
  },
  'pipe.cache': {
    data: edgeDefaults,
    style: { stroke: 'var(--ma-arrow)', strokeWidth: 2 },
  },
};

const legendTokens = new Set(['legend.square', 'legend.circle', 'legend.hexagon']);

export const getKnownStyleTokens = (): Set<string> => new Set([
  ...Object.keys(nodeTokenMap),
  ...Object.keys(edgeTokenMap),
  ...Array.from(legendTokens),
]);

export const resolveNodeStyle = (node: ChipNode): ResolvedNodeStyle => {
  const token = node.styleToken || 'memory.l1';
  return nodeTokenMap[token] || nodeTokenMap['memory.l1'];
};

export const resolveEdgeStyle = (edge: ChipEdge): ResolvedEdgeStyle => {
  const token = edge.styleToken || 'pipe.compute';
  const resolved = edgeTokenMap[token] || edgeTokenMap['pipe.compute'];

  if (edge.dash) {
    return {
      data: {
        ...resolved.data,
        dashed: true,
        animate: true,
      },
      style: {
        ...resolved.style,
        stroke: '#f07c1d',
      },
    };
  }

  return resolved;
};
