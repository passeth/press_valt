import type { GraphData, GraphNode, GraphLink } from "@/types/graph";

/* ── Raw InfraNodus Graphology response shape ── */

interface RawNodeAttributes {
  community?: number;
  bc?: number;
  degree?: number;
  weighedDegree?: number;
  x?: number;
  y?: number;
}

interface RawNode {
  key?: string;
  attributes?: RawNodeAttributes;
  // Flat fallback (in case API changes format)
  id?: string;
  label?: string;
  community?: number;
  bc?: number;
  degree?: number;
  weighedDegree?: number;
  x?: number;
  y?: number;
}

interface RawEdgeAttributes {
  weight?: number;
}

interface RawEdge {
  key?: string;
  source?: string;
  target?: string;
  attributes?: RawEdgeAttributes;
  // Flat fallback
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
 * InfraNodus returns Graphology serialized format:
 *   nodes[]: { key: "word", attributes: { bc, community, degree, weighedDegree, x, y } }
 *   edges[]: { source: "word", target: "word", attributes: { weight } }
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

  const nodes: GraphNode[] = rawNodes.map((n) => {
    // Graphology format: { key, attributes: { ... } }
    const attrs = n.attributes;
    const id = n.key ?? n.id ?? "";
    return {
      id,
      label: id,
      community: attrs?.community ?? n.community ?? 0,
      bc: attrs?.bc ?? n.bc ?? 0,
      degree: attrs?.degree ?? n.degree ?? 0,
      weighedDegree: attrs?.weighedDegree ?? n.weighedDegree ?? 0,
      ...(((attrs?.x ?? n.x) != null) && { x: attrs?.x ?? n.x }),
      ...(((attrs?.y ?? n.y) != null) && { y: attrs?.y ?? n.y }),
    };
  });

  const links: GraphLink[] = Array.isArray(rawEdges)
    ? rawEdges
        .filter((e) => e.source && e.target)
        .map((e) => ({
          source: e.source!,
          target: e.target!,
          weight: e.attributes?.weight ?? e.weight ?? 1,
        }))
    : [];

  return { nodes, links };
}
