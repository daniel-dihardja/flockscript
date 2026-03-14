"use client";

import "@xyflow/react/dist/style.css";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
} from "@xyflow/react";

import { usePatch } from "./patch-provider";

// ─── Signal colour map ────────────────────────────────────────────────────────

const signalColor: Record<string, string> = {
  audio: "#ffffff",
  mod: "#a78bfa",
  seq: "#34d399",
};

// ─── Layout constants ─────────────────────────────────────────────────────────

const COL_WIDTH = 180;
const ROW_HEIGHT = 90;
const H_PAD = 40;
const V_PAD = 40;

// ─── Patch → Flow conversion ──────────────────────────────────────────────────

type PatchDevice = { id: string; type: string };
type PatchRoute = { from: string; to: string; signal: string };
type PatchJson = { devices?: PatchDevice[]; routes?: PatchRoute[] };

function patchToFlow(patchStr: string): { nodes: Node[]; edges: Edge[] } {
  let parsed: PatchJson = {};
  try {
    parsed = JSON.parse(patchStr);
  } catch {
    return { nodes: [], edges: [] };
  }

  const devices: PatchDevice[] = parsed.devices ?? [];
  const routes: PatchRoute[] = parsed.routes ?? [];

  // Simple left-to-right auto-layout: group devices by how many hops from a
  // source (no incoming audio routes). Mod/seq sources go on col 0.
  const inDegree = new Map<string, number>(devices.map((d) => [d.id, 0]));
  for (const r of routes) {
    const targetId = r.to.split(".")[0];
    if (targetId) inDegree.set(targetId, (inDegree.get(targetId) ?? 0) + 1);
  }

  // Assign columns via BFS
  const col = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      col.set(id, 0);
      queue.push(id);
    }
  }
  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const r of routes) {
    const src = r.from.split(".")[0];
    const tgt = r.to.split(".")[0];
    if (!src || !tgt) continue;
    if (!adj.has(src)) adj.set(src, []);
    adj.get(src)!.push(tgt);
  }
  while (queue.length) {
    const id = queue.shift()!;
    const c = col.get(id) ?? 0;
    for (const next of adj.get(id) ?? []) {
      if (!col.has(next)) {
        col.set(next, c + 1);
        queue.push(next);
      }
    }
  }

  // Count devices per column for row positioning
  const colCount = new Map<number, number>();
  const rowIndex = new Map<string, number>();
  for (const d of devices) {
    const c = col.get(d.id) ?? 0;
    rowIndex.set(d.id, colCount.get(c) ?? 0);
    colCount.set(c, (colCount.get(c) ?? 0) + 1);
  }

  const nodes: Node[] = devices.map((d) => {
    const c = col.get(d.id) ?? 0;
    const r = rowIndex.get(d.id) ?? 0;
    return {
      id: d.id,
      position: { x: H_PAD + c * COL_WIDTH, y: V_PAD + r * ROW_HEIGHT },
      data: { label: `${d.type} · ${d.id}` },
      style: {
        background: "#18181b",
        border: "1px solid #3f3f46",
        borderRadius: 6,
        color: "#f4f4f5",
        fontSize: 11,
        padding: "6px 10px",
        minWidth: 120,
      },
    };
  });

  const edges: Edge[] = routes.map((r, i) => {
    const srcId = r.from.split(".")[0] ?? "";
    const tgtId = r.to.split(".")[0] ?? "";
    const color = signalColor[r.signal] ?? "#6b7280";
    return {
      id: `e${i}`,
      source: srcId,
      target: tgtId,
      label: r.signal,
      animated: r.signal === "audio",
      style: { stroke: color, strokeWidth: 1.5 },
      labelStyle: { fill: color, fontSize: 9 },
      labelBgStyle: { fill: "#09090b", fillOpacity: 0.8 },
    };
  });

  return { nodes, edges };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PatchFlow() {
  const { patch } = usePatch();
  const { nodes, edges } = useMemo(() => patchToFlow(patch), [patch]);

  return (
    <div className="h-full w-full bg-zinc-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#3f3f46"
        />
      </ReactFlow>
    </div>
  );
}
