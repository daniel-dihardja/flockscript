import * as React from "react";
import { Button } from "@workspace/ui/components/button";

type EngineStatus = {
  label: string;
  state: "idle" | "initializing" | "running" | "error";
};

type LiveEditorToolbarProps = {
  engineStatus: EngineStatus;
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  samples: string[];
  selectedSampleIndex: number;
  onSampleChange: (index: number) => void;
  debugPanelOpen: boolean;
  onToggleDebug: () => void;
  onRunLine: () => void;
  onRunBlock: () => void;
};

export function LiveEditorToolbar({
  engineStatus,
  categories,
  selectedCategory,
  onCategoryChange,
  samples,
  selectedSampleIndex,
  onSampleChange,
  debugPanelOpen,
  onToggleDebug,
  onRunLine,
  onRunBlock,
}: LiveEditorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-700 bg-neutral-900 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <span
          className={`h-2 w-2 rounded-full ${
            engineStatus.state === "running"
              ? "bg-emerald-500"
              : engineStatus.state === "initializing"
                ? "bg-amber-400 animate-pulse"
                : engineStatus.state === "error"
                  ? "bg-rose-500"
                  : "bg-neutral-500"
          }`}
        />
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <span>Audio</span>
          <span
            className={
              engineStatus.state === "running"
                ? "text-emerald-300"
                : engineStatus.state === "error"
                  ? "text-rose-400"
                  : "text-muted-foreground"
            }
          >
            {engineStatus.label}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="font-semibold uppercase tracking-[0.3em] text-[10px]"
            onClick={onRunLine}
          >
            Run line
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="font-semibold uppercase tracking-[0.3em] text-[10px]"
            onClick={onRunBlock}
          >
            Run block
          </Button>
        </div>
        <label className="flex flex-col text-[10px] uppercase tracking-widest text-muted-foreground">
          Category
          <select
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
            value={selectedCategory}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-[10px] uppercase tracking-widest text-muted-foreground">
          Sample
          <select
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
            value={selectedSampleIndex}
            onChange={(event) => onSampleChange(Number(event.target.value))}
          >
            {samples.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="font-semibold uppercase tracking-[0.3em] text-[10px]"
          onClick={onToggleDebug}
        >
          {debugPanelOpen ? "Hide debug" : "Show debug"}
        </Button>
      </div>
    </div>
  );
}

