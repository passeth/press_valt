"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { GraphData, GraphNode } from "@/types/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const COMMUNITY_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#ec4899", "#3b82f6", "#f97316"];

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
      if (charge) charge.strength(-200);
      const link = fgRef.current.d3Force("link");
      if (link && link.distance) link.distance(80);
    }
  }, [clonedData]);

  const handleNodeHover = useCallback((node: { id?: string | number } | null) => {
    setHoverNode(node?.id != null ? String(node.id) : null);
  }, []);

  const linkColor = useCallback(() => "rgba(255,255,255,0.25)", []);

  const linkWidth = useCallback(
    (link: { source?: LinkEndpoint; target?: LinkEndpoint }) => {
      if (!hoverNode) return 0.5;
      const s = getNodeId(link.source);
      const t = getNodeId(link.target);
      return s === hoverNode || t === hoverNode ? 2.5 : 0.3;
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
          backgroundColor="#0D0D0D"
          nodeCanvasObject={(node, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const graphNode = node as unknown as GraphNode;
            const nodeId = String(node.id ?? "");
            const x = graphNode.x ?? 0;
            const y = graphNode.y ?? 0;
            const radius = 5 + (graphNode.bc / maxBc) * 14;
            const color = COMMUNITY_COLORS[graphNode.community % COMMUNITY_COLORS.length];

            const isHover = hoverNode === nodeId;
            const isNeighbor = hoverNode !== null && (neighbors.get(hoverNode)?.has(nodeId) ?? false);
            const isDimmed = hoverNode !== null && !isHover && !isNeighbor;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);

            if (isHover || isNeighbor) {
              ctx.shadowColor = "rgba(255,255,255,0.6)";
              ctx.shadowBlur = 12;
            }

            ctx.globalAlpha = isDimmed ? 0.15 : isHover || isNeighbor ? 1.0 : 0.85;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";

            const fontSize = Math.max(11 / globalScale, 3);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = isDimmed ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.9)";
            ctx.fillText(graphNode.label, x, y + radius + 3);

            if (isHover) {
              ctx.font = `bold ${Math.max(13 / globalScale, 4)}px sans-serif`;
              ctx.fillStyle = "#ffffff";
              ctx.fillText(graphNode.label, x, y + radius + 3);
            }

            ctx.globalAlpha = 1;
          }}
          nodeCanvasObjectMode={() => "replace"}
          onNodeHover={handleNodeHover}
          linkColor={linkColor}
          linkWidth={linkWidth}
          cooldownTicks={100}
          onEngineStop={() => fgRef.current?.zoomToFit(400, 40)}
        />
      )}
    </div>
  );
}
