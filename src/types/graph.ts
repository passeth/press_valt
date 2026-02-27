/* ── InfraNodus Knowledge Graph Types ── */

export interface GraphNode {
  id: string;
  label: string;
  community: number;
  bc: number;
  degree: number;
  weighedDegree: number;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
