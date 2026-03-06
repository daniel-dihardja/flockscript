"use client";

import * as React from "react";
import { EditorState } from "@codemirror/state";
import { setDiagnostics } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { SAMPLE_CATEGORIES } from "./examples";
import { LiveEditorToolbar } from "./live-editor-toolbar";
import { LiveEditorDebugPanel } from "./live-editor-debug-panel";
import { useAudioEngine } from "./use-audio-engine";
import { useFlockScriptCompiler } from "./use-flockscript-compiler";
import { useCodeMirrorEditor, highlightEffect } from "./use-code-mirror-editor";
import syntaxConfig from "./syntax-config.json";

type SyntaxStyleConfig = {
  theme: Record<string, Record<string, string>>;
};

const { theme: defaultTheme } = syntaxConfig as SyntaxStyleConfig;

const defaultScript = SAMPLE_CATEGORIES[0]?.samples[0]?.code ?? "";

type EvalPayload = {
  type: "block" | "line" | "selection";
  text: string;
  from: number;
  to: number;
};

type LiveEditorProps = {
  initialDoc?: string;
};

type LiveEditorHandle = {
  runLine: () => void;
};

function isBoundaryLine(text: string) {
  const trimmed = text.trim();
  return trimmed.length === 0 || trimmed.startsWith("---");
}

function getBlockRange(state: EditorState, pos: number) {
  const doc = state.doc;
  const line = doc.lineAt(pos);
  let startLine = line.number;
  let endLine = line.number;

  while (startLine > 1) {
    const prev = doc.line(startLine - 1);
    if (isBoundaryLine(prev.text)) {
      if (prev.text.trim().startsWith("---")) {
        startLine = prev.number + 1;
      }
      break;
    }
    startLine -= 1;
  }

  while (endLine < doc.lines) {
    const next = doc.line(endLine + 1);
    if (isBoundaryLine(next.text)) {
      break;
    }
    endLine += 1;
  }

  const start = doc.line(startLine).from;
  const end = doc.line(endLine).to;

  return { from: start, to: end };
}

export const LiveEditor = React.forwardRef(LiveEditorComponent);

function LiveEditorComponent(
  { initialDoc = defaultScript }: LiveEditorProps,
  ref: React.ForwardedRef<LiveEditorHandle>,
) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const workerRef = React.useRef<Worker | null>(null);
  const requestIdRef = React.useRef(0);
  const debounceRef = React.useRef<number | null>(null);
  const highlightTimeoutRef = React.useRef<number | null>(null);

  const {
    engineStatus,
    ensureEngineRunning,
    applyPatchToEngine,
    silence,
  } = useAudioEngine();

  const [lastEval, setLastEval] = React.useState<EvalPayload | null>(null);

  const {
    compileState,
    compileResult,
    debugPatch,
    lastExecMode,
    setCompiling,
    setSilenceResult,
    compileAndApply,
  } = useFlockScriptCompiler();

  const [selectedCategory, setSelectedCategory] = React.useState(
    SAMPLE_CATEGORIES[0]?.name ?? "",
  );
  const [selectedSampleIndex, setSelectedSampleIndex] = React.useState(0);
  const [debugPanelOpen, setDebugPanelOpen] = React.useState(false);

  const themeExtension = React.useMemo(
    () => EditorView.theme(defaultTheme, { dark: true }),
    [],
  );

  const clearLineHighlight = React.useCallback((viewRef: React.RefObject<EditorView | null>) => {
    if (!viewRef.current) {
      return;
    }
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      if (!viewRef.current) {
        return;
      }
      viewRef.current.dispatch({
        effects: highlightEffect.of(null),
      });
      highlightTimeoutRef.current = null;
    }, 1000);
  }, []);

  const executeRangeRef = React.useRef<(view: EditorView, range: { from: number; to: number }, kind: EvalPayload["type"]) => boolean>(() => false);

  const executeBlock = React.useCallback((view: EditorView) => {
    const range = getBlockRange(view.state, view.state.selection.main.head);
    return executeRangeRef.current(view, range, "block");
  }, []);

  const executeLine = React.useCallback((view: EditorView) => {
    const line = view.state.doc.lineAt(view.state.selection.main.head);
    return executeRangeRef.current(view, { from: line.from, to: line.to }, "line");
  }, []);

  const executeSelection = React.useCallback((view: EditorView) => {
    const selection = view.state.selection.main;
    if (selection.from === selection.to) {
      return false;
    }
    return executeRangeRef.current(view, { from: selection.from, to: selection.to }, "selection");
  }, []);

  const compileNow = React.useCallback((source: string) => {
    if (!workerRef.current) {
      return;
    }
    requestIdRef.current += 1;
    setCompiling();
    workerRef.current.postMessage({
      id: requestIdRef.current,
      source,
    });
  }, [setCompiling]);

  const scheduleCompile = React.useCallback((source: string) => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      compileNow(source);
    }, 120);
  }, [compileNow]);

  const { viewRef } = useCodeMirrorEditor({
    hostRef,
    initialDoc,
    themeExtension,
    onDocChange: scheduleCompile,
    onExecuteBlock: executeBlock,
    onExecuteSelection: executeSelection,
  });

  executeRangeRef.current = (
    view: EditorView,
    range: { from: number; to: number },
    kind: EvalPayload["type"],
  ) => {
    const raw = view.state.doc.sliceString(range.from, range.to);
    const text = raw.trim();
    ensureEngineRunning();
    if (!text) {
      return false;
    }
    setLastEval({
      type: kind,
      text,
      from: range.from,
      to: range.to,
    });
    view.dispatch({
      effects: highlightEffect.of(range),
    });

    const [headToken] = text.split(/\s+/);
    const normalizedHead = headToken?.toLowerCase() ?? "";
    if (normalizedHead === "sil" || normalizedHead === "silence") {
      silence();
      setSilenceResult({ devices: [], routes: [] });
      if (viewRef.current) {
        viewRef.current.dispatch(
          setDiagnostics(viewRef.current.state, []),
        );
      }
      clearLineHighlight(viewRef);
      return true;
    }

    const ok = compileAndApply(text, viewRef.current, (patch) => {
      applyPatchToEngine(patch);
    });
    if (ok) {
      clearLineHighlight(viewRef);
    }
    return true;
  };

  React.useEffect(() => {
    const worker = new Worker(
      new URL("./workers/dsl-worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const payload = event.data as {
        id: number;
        ok: boolean;
        diagnostics: any[];
        patch?: any;
      };
      if (payload.id !== requestIdRef.current) {
        return;
      }
      if (viewRef.current) {
        viewRef.current.dispatch(
          setDiagnostics(viewRef.current.state, payload.diagnostics),
        );
      }
    };

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      worker.terminate();
      workerRef.current = null;
    };
  }, [viewRef]);

  const categories = React.useMemo(
    () => SAMPLE_CATEGORIES.map((cat) => cat.name),
    [],
  );
  const currentCategory =
    SAMPLE_CATEGORIES.find((cat) => cat.name === selectedCategory) ??
    SAMPLE_CATEGORIES[0];
  const currentSample =
    currentCategory?.samples[selectedSampleIndex] ?? currentCategory?.samples[0];
  const currentSamplesLabels = React.useMemo(
    () => currentCategory?.samples.map((sample) => sample.label) ?? [],
    [currentCategory],
  );

  React.useEffect(() => {
    if (!currentSample || !viewRef.current) {
      return;
    }
    viewRef.current.dispatch({
      changes: {
        from: 0,
        to: viewRef.current.state.doc.length,
        insert: currentSample.code,
      },
    });
  }, [currentSample, viewRef]);

  React.useEffect(() => {
    setSelectedSampleIndex(0);
  }, [selectedCategory]);

  const runLine = React.useCallback(() => {
    if (!viewRef.current) {
      return;
    }
    executeBlock(viewRef.current);
  }, [viewRef, executeBlock]);

  React.useImperativeHandle(ref, () => ({
    runLine,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden border border-neutral-800 bg-background shadow-sm">
      <LiveEditorToolbar
        engineStatus={engineStatus}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        samples={currentSamplesLabels}
        selectedSampleIndex={selectedSampleIndex}
        onSampleChange={setSelectedSampleIndex}
        debugPanelOpen={debugPanelOpen}
        onToggleDebug={() => setDebugPanelOpen((prev) => !prev)}
        onRunLine={() => {
          if (viewRef.current) {
            executeLine(viewRef.current);
          }
        }}
        onRunBlock={() => {
          if (viewRef.current) {
            executeBlock(viewRef.current);
          }
        }}
      />
      <div className="min-h-0 flex-1" ref={hostRef} />
      <LiveEditorDebugPanel
        open={debugPanelOpen}
        lastEval={lastEval}
        lastExecMode={lastExecMode}
        debugPatch={debugPatch}
      />
    </div>
  );
}
