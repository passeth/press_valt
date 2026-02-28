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

function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `rgb(${lr},${lg},${lb})`;
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

  const maxBc = useMemo(
    () => Math.max(...graphData.nodes.map((n) => n.bc), 0.001),
    [graphData.nodes]
  );

  const bcThreshold = useMemo(() => {
    const sorted = graphData.nodes.map((n) => n.bc).sort((a, b) => b - a);
    const idx = Math.max(0, Math.floor(sorted.length * 0.3) - 1);
    return sorted[idx] ?? 0;
  }, [graphData.nodes]);

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
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (fgRef.current) {
      const charge = fgRef.current.d3Force("charge");
      if (charge) charge.strength(-400);
      const link = fgRef.current.d3Force("link");
      if (link && link.distance) link.distance(120);
    }
  }, [clonedData]);

  const handleNodeHover = useCallback((node: { id?: string | number } | null) => {
    setHoverNode(node?.id != null ? String(node.id) : null);
  }, []);

  const linkColorFn = useCallback(
    (link: { source?: LinkEndpoint; target?: LinkEndpoint }) => {
      const sourceId = getNodeId(link.source);
      const color = nodeColorMap.get(sourceId) ?? "#ffffff";
      if (!hoverNode) return color + "59";
      const targetId = getNodeId(link.target);
      if (sourceId === hoverNode || targetId === hoverNode) return color + "D9";
      return color + "0D";
    },
    [nodeColorMap, hoverNode]
  );

  const linkWidthFn = useCallback(
    (link: { source?: LinkEndpoint; target?: LinkEndpoint; weight?: number }) => {
      const base = 0.5 + (link.weight ?? 1) * 0.8;
      if (!hoverNode) return base;
      const s = getNodeId(link.source);
      const t = getNodeId(link.target);
      return s === hoverNode || t === hoverNode ? base * 2.5 : 0.15;
    },
    [hoverNode]
  );

  const particleColorFn = useCallback(
    (link: { source?: LinkEndpoint }) => {
      const sourceId = getNodeId(link.source);
      return (nodeColorMap.get(sourceId) ?? "#ffffff") + "99";
    },
    [nodeColorMap]
  );

  return (
    <div ref={containerRef} style={{ width: "100%", height }}>
      {containerWidth > 0 && (
        <ForceGraph2D
          ref={fgRef as unknown as InternalForceGraphRef}
          graphData={clonedData}
          width={containerWidth}
          height={height}
          backgroundColor="#0d1117"
          linkColor={linkColorFn}
          linkWidth={linkWidthFn}
          linkCurvature={0.15}
          linkDirectionalParticles={3}
          linkDirectionalParticleWidth={2.5}
          linkDirectionalParticleSpeed={0.004}
          linkDirectionalParticleColor={particleColorFn}
          nodeCanvasObject={(node, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const gn = node as unknown as GraphNode;
            const nodeId = String(node.id ?? "");
            const x = gn.x ?? 0;
            const y = gn.y ?? 0;
            const bcRatio = gn.bc / maxBc;
            const radius = 3 + bcRatio * 32;
            const color = COMMUNITY_COLORS[gn.community % COMMUNITY_COLORS.length];

            const isHover = hoverNode === nodeId;
            const isNeighbor = hoverNode !== null && (neighbors.get(hoverNode)?.has(nodeId) ?? false);
            const isDimmed = hoverNode !== null && !isHover && !isNeighbor;
            const isImportant = gn.bc >= bcThreshold;

            // 1. OUTER GLOW HALO
            const glowRadius = radius * 3.5;
            const glow = ctx.createRadialGradient(x, y, radius * 0.3, x, y, glowRadius);
            glow.addColorStop(0, color + (isHover ? "80" : "40"));
            glow.addColorStop(0.6, color + "15");
            glow.addColorStop(1, "transparent");
            ctx.beginPath();
            ctx.arc(x, y, glowRadius, 0, 2 * Math.PI);
            ctx.fillStyle = glow;
            ctx.globalAlpha = isDimmed ? 0.03 : isHover ? 1.0 : 0.7;
            ctx.fill();

            // 2. SHADOW GLOW (hover/neighbor)
            if ((isHover || isNeighbor) && !isDimmed) {
              ctx.save();
              ctx.shadowColor = color;
              ctx.shadowBlur = isHover ? 35 : 18;
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.globalAlpha = isHover ? 0.6 : 0.35;
              ctx.fill();
              ctx.restore();
            }

            // 3. MAIN CIRCLE
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.globalAlpha = isDimmed ? 0.1 : isHover ? 1.0 : isNeighbor ? 0.95 : 0.85;
            ctx.fillStyle = color;
            ctx.fill();

            // 4. BORDER RING
            if (!isDimmed) {
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, 2 * Math.PI);
              ctx.strokeStyle = lightenColor(color, 0.3);
              ctx.lineWidth = isHover ? 2 : 1;
              ctx.globalAlpha = 0.6;
              ctx.stroke();
            }

            // 5. INNER HIGHLIGHT (3D depth)
            if (!isDimmed && radius > 5) {
              const hlX = x - radius * 0.25;
              const hlY = y - radius * 0.25;
              const hlR = radius * 0.55;
              const hl = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlR);
              hl.addColorStop(0, "rgba(255,255,255,0.3)");
              hl.addColorStop(1, "rgba(255,255,255,0)");
              ctx.beginPath();
              ctx.arc(hlX, hlY, hlR, 0, 2 * Math.PI);
              ctx.fillStyle = hl;
              ctx.globalAlpha = isHover ? 0.5 : 0.25;
              ctx.fill();
            }

            // 6. LABEL
            const fontSize = Math.max((4 + bcRatio * 12) / globalScale, 2);
            const isBold = isImportant || isHover;
            ctx.font = `${isBold ? "bold " : ""}${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";

            if (isDimmed) {
              ctx.globalAlpha = 0.08;
              ctx.fillStyle = "rgba(255,255,255,0.08)";
            } else if (isHover) {
              ctx.globalAlpha = 1.0;
              ctx.fillStyle = "#ffffff";
            } else if (isImportant) {
              ctx.globalAlpha = 0.95;
              ctx.fillStyle = "#ffffff";
            } else {
              ctx.globalAlpha = 0.6;
              ctx.fillStyle = "rgba(255,255,255,0.6)";
            }

            if ((isHover || isImportant) && !isDimmed) {
              ctx.save();
              ctx.shadowColor = "rgba(0,0,0,0.8)";
              ctx.shadowBlur = 4;
              ctx.fillText(gn.label, x, y + radius + 3);
              ctx.restore();
            } else {
              ctx.fillText(gn.label, x, y + radius + 3);
            }

            // RESET
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";
          }}
          nodeCanvasObjectMode={() => "replace"}
          onNodeHover={handleNodeHover}
          cooldownTicks={100}
          onEngineStop={() => fgRef.current?.zoomToFit(400, 80)}
        />
      )}
    </div>
  );
}
