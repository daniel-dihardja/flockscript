import * as React from "react";
import type { CompileResult as CompilerResult } from "@workspace/compiler";

type EvalPayload = {
  type: "block" | "line" | "selection";
  text: string;
  from: number;
  to: number;
};

type ExecMode = "silence" | "compile" | "error" | null;

type LiveEditorDebugPanelProps = {
  open: boolean;
  lastEval: EvalPayload | null;
  lastExecMode: ExecMode;
  debugPatch: CompilerResult["patch"] | null;
};

export function LiveEditorDebugPanel({
  open,
  lastEval,
  lastExecMode,
  debugPatch,
}: LiveEditorDebugPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="border-t border-neutral-700 bg-[#070b1a] px-4 py-3 text-xs text-muted-foreground">
      <div className="flex items-center justify-between text-[11px] text-foreground uppercase tracking-[0.35em]">
        <span>Execution debug</span>
        <span className="text-[10px] text-muted-foreground">
          {lastEval ? `${lastEval.type} • ${lastExecMode ?? "idle"}` : "no execution yet"}
        </span>
      </div>
      {lastEval && (
        <div className="mt-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Source
          </div>
          <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded border border-neutral-800 bg-[#020617] p-2 text-[11px] font-mono text-[#e5e7eb]">
            {lastEval.text}
          </pre>
        </div>
      )}
      <div className="mt-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Patch sent to engine
        </div>
        <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded border border-neutral-800 bg-[#0c111c] p-3 text-[11px] font-mono text-[#f8fafc]">
          {debugPatch
            ? JSON.stringify(debugPatch, null, 2)
            : "No compiled patch available"}
        </pre>
      </div>
    </div>
  );
}

