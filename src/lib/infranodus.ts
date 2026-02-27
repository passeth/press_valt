import type { GraphData, GraphNode, GraphLink } from "@/types/graph";

/* ── Raw InfraNodus response shape (partial) ── */

interface RawNode {
  id?: string;
  label?: string;
  community?: number;
  bc?: number;
  degree?: number;
  weighedDegree?: number;
  x?: number;
  y?: number;
}

interface RawEdge {
  source?: string;
  target?: string;
  weight?: number;
}

interface RawGraphologyGraph {
  nodes?: RawNode[];
  edges?: RawEdge[];
}

/**
 * Safely extract graph data (nodes + edges) from an InfraNodus API response.
 * Returns undefined if no valid graph data is present.
 *
 * InfraNodus endpoints (graphAndStatements, graphAndAdvice) return:
 *   data.graph.graphologyGraph.nodes[]
 *   data.graph.graphologyGraph.edges[]
 *
 * The googleSearchVsIntentAiAdvice endpoint may not include graph data.
 */
export function extractGraphData(
  data: Record<string, unknown>,
): GraphData | undefined {
  const graph = data?.graph as Record<string, unknown> | undefined;
  if (!graph) return undefined;

  const graphologyGraph = graph.graphologyGraph as RawGraphologyGraph | undefined;
  if (!graphologyGraph) return undefined;

  const rawNodes = graphologyGraph.nodes;
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) return undefined;

  const rawEdges = graphologyGraph.edges;

  const nodes: GraphNode[] = rawNodes.map((n) => ({
    id: n.id ?? "",
    label: n.label ?? "",
    community: n.community ?? 0,
    bc: n.bc ?? 0,
    degree: n.degree ?? 0,
    weighedDegree: n.weighedDegree ?? 0,
    ...(n.x != null && { x: n.x }),
    ...(n.y != null && { y: n.y }),
  }));

  const links: GraphLink[] = Array.isArray(rawEdges)
    ? rawEdges
        .filter((e) => e.source && e.target)
        .map((e) => ({
          source: e.source!,
          target: e.target!,
          weight: e.weight ?? 1,
        }))
    : [];

  return { nodes, links };
}
