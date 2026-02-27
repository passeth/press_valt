"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { GraphData, GraphNode } from "@/types/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const COMMUNITY_COLORS = [
  "#4ecdc4",
  "#45b7d1",
  "#f7dc6f",
  "#bb8fce",
  "#82e0aa",
  "#f1948a",
  "#85c1e9",
  "#f0b27a",
];

interface KnowledgeGraphProps {
  graphData: GraphData;
  height?: number;
}

type ForceGraphRef = {
  d3Force: (name: string) => {
    strength: (n: number) => void;
    distance?: (n: number) => void;
  } | null;
  zoomToFit: (duration: number, padding: number) => void;
};

type InternalForceGraphRef = { current: ForceGraphMethods | undefined };

type LinkEndpoint = string | number | undefined | { id?: string | number };

function getNodeId(val: LinkEndpoint): string {
  if (typeof val === "object" && val !== null) return String(val.id ?? "");
  return String(val ?? "");
}

export default function KnowledgeGraph({ graphData, height = 400 }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<ForceGraphRef | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  const clonedData = useMemo(
    () => ({
      nodes: graphData.nodes.map((n) => ({ ...n })),
      links: graphData.links.map((l) => ({ ...l })),
    }),
    [graphData]
  );

  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    graphData.links.forEach((link) => {
      if (!map.has(link.source)) map.set(link.source, new Set());
      if (!map.has(link.target)) map.set(link.target, new Set());
      map.get(link.source)?.add(link.target);
      map.get(link.target)?.add(link.source);
    });
    return map;
  }, [graphData]);

  const maxBc = useMemo(() => Math.max(...graphData.nodes.map((n) => n.bc), 0.001), [graphData.nodes]);

  const nodeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    graphData.nodes.forEach((n) => {
      map.set(n.id, COMMUNITY_COLORS[n.community % COMMUNITY_COLORS.length]);
    });
    return map;
  }, [graphData.nodes]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (fgRef.current) {
      const charge = fgRef.current.d3Force("charge");
      if (charge) charge.strength(-300);
      const link = fgRef.current.d3Force("link");
      if (link && link.distance) link.distance(100);
    }
  }, [clonedData]);

  const handleNodeHover = useCallback((node: { id?: string | number } | null) => {
    setHoverNode(node?.id != null ? String(node.id) : null);
  }, []);

  const linkColorFn = useCallback(
    (link: { source?: LinkEndpoint; target?: LinkEndpoint }) => {
      const sourceId = getNodeId(link.source);
      const color = nodeColorMap.get(sourceId) ?? "#ffffff";
      if (!hoverNode) return color + "40";
      const targetId = getNodeId(link.target);
      if (sourceId === hoverNode || targetId === hoverNode) return color + "BB";
      return color + "0A";
    },
    [nodeColorMap, hoverNode]
  );

  const linkWidth = useCallback(
    (link: { source?: LinkEndpoint; target?: LinkEndpoint }) => {
      if (!hoverNode) return 0.8;
      const s = getNodeId(link.source);
      const t = getNodeId(link.target);
      return s === hoverNode || t === hoverNode ? 3 : 0.2;
    },
    [hoverNode]
  );

  return (
    <div ref={containerRef} style={{ width: "100%", height }}>
      {containerWidth > 0 && (
        <ForceGraph2D
          ref={fgRef as unknown as InternalForceGraphRef}
          graphData={clonedData}
          width={containerWidth}
          height={height}
          backgroundColor="#1a1a2e"
          nodeCanvasObject={(node, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const graphNode = node as unknown as GraphNode;
            const nodeId = String(node.id ?? "");
            const x = graphNode.x ?? 0;
            const y = graphNode.y ?? 0;
            const bcRatio = graphNode.bc / maxBc;
            const radius = 4 + bcRatio * 26;
            const color = COMMUNITY_COLORS[graphNode.community % COMMUNITY_COLORS.length];

            const isHover = hoverNode === nodeId;
            const isNeighbor = hoverNode !== null && (neighbors.get(hoverNode)?.has(nodeId) ?? false);
            const isDimmed = hoverNode !== null && !isHover && !isNeighbor;

            // Outer glow aura
            const gradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 2.5);
            gradient.addColorStop(0, color + "40");
            gradient.addColorStop(1, "transparent");
            ctx.beginPath();
            ctx.arc(x, y, radius * 2.5, 0, 2 * Math.PI);
            ctx.fillStyle = gradient;
            ctx.globalAlpha = isDimmed ? 0.05 : 0.6;
            ctx.fill();

            // Main circle
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.globalAlpha = isDimmed ? 0.12 : isHover || isNeighbor ? 1.0 : 0.9;
            ctx.fillStyle = color;
            ctx.fill();

            // White highlight for 3D effect
            ctx.beginPath();
            ctx.arc(x, y, radius * 0.7, 0, 2 * Math.PI);
            ctx.globalAlpha = isDimmed ? 0 : 0.15;
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            // Hover/neighbor glow
            if (isHover || isNeighbor) {
              ctx.shadowColor = color;
              ctx.shadowBlur = 20;
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, 2 * Math.PI);
              ctx.globalAlpha = 1.0;
              ctx.fillStyle = color;
              ctx.fill();
              ctx.shadowBlur = 0;
              ctx.shadowColor = "transparent";
            }

            // Labels — always visible, size proportional to importance
            const labelSize = Math.max((3 + bcRatio * 9) / globalScale, 2.5);
            ctx.font = `${isHover ? "bold " : ""}${labelSize}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.globalAlpha = isDimmed ? 0.08 : isHover ? 1.0 : 0.85;
            ctx.fillStyle = isDimmed ? "rgba(255,255,255,0.08)" : isHover ? "#ffffff" : "rgba(255,255,255,0.85)";
            ctx.fillText(graphNode.label, x, y + radius + 2);

            // Reset
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
          }}
          nodeCanvasObjectMode={() => "replace"}
          onNodeHover={handleNodeHover}
          linkColor={linkColorFn}
          linkWidth={linkWidth}
          cooldownTicks={100}
          onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
        />
      )}
    </div>
  );
}
