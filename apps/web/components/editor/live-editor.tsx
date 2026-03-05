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

const baseThemeClone = (source: Record<string, Record<string, string>>) =>
  JSON.parse(JSON.stringify(source)) as Record<string, Record<string, string>>;

const createThemeVariant = (
  overrides: Record<string, Record<string, string>>,
) => {
  const clone = baseThemeClone(defaultTheme);
  Object.entries(overrides).forEach(([selector, styles]) => {
    clone[selector] = { ...(clone[selector] ?? {}), ...styles };
  });
  return clone;
};

const applySyntaxColors = (
  base: Record<string, Record<string, string>>,
  colors: (typeof SYNTAX_VARIATIONS)[number]["colors"],
) => {
  const clone = baseThemeClone(base);
  const apply = (selector: string, styles: Record<string, string>) => {
    clone[selector] = { ...(clone[selector] ?? {}), ...styles };
  };
  apply(".cm-dsl-main-keyword", {
    color: colors.mainKeyword,
    fontWeight: "700",
  });
  apply(".cm-dsl-waveform", {
    color: colors.waveform,
    fontWeight: "400",
  });
  apply(".cm-dsl-gain", {
    color: colors.gain,
  });
  apply(".cm-dsl-param", {
    color: colors.param,
    fontWeight: "700",
  });
  apply(".cm-dsl-name, .cm-dsl-route-source, .cm-dsl-route-target", {
    backgroundColor: colors.nameBg,
  });
  return clone;
};

const THEME_VARIATIONS = [
  {
    id: "nebula",
    label: "Nebula",
    theme: defaultTheme,
  },
  {
    id: "lumen",
    label: "Lumen",
    theme: createThemeVariant({
      "&": {
        backgroundImage: "linear-gradient(160deg, #1f1b2e, #3c1053 45%, #020617)",
      },
      ".cm-gutters": {
        backgroundColor: "rgba(8, 8, 18, 0.85)",
        borderRight: "1px solid rgba(248, 113, 113, 0.3)",
      },
      ".cm-selectionBackground": {
        backgroundColor: "rgba(248, 113, 113, 0.35)",
      },
    }),
  },
  {
    id: "pulse",
    label: "Pulse",
    theme: createThemeVariant({
      "&": {
        backgroundImage: "linear-gradient(160deg, #020617, #0f172a 45%, #0f766e)",
      },
      ".cm-gutters": {
        backgroundColor: "rgba(2, 6, 23, 0.9)",
        borderRight: "1px solid rgba(59, 130, 246, 0.4)",
      },
      ".cm-selectionBackground": {
        backgroundColor: "rgba(59, 130, 246, 0.4)",
      },
    }),
  },
  {
    id: "drone",
    label: "Drone",
    theme: createThemeVariant({
      "&": {
        backgroundImage: "linear-gradient(160deg, #030712, #0f0f1f 50%, #14202a)",
        color: "#cbd5f5",
      },
      ".cm-gutters": {
        backgroundColor: "rgba(4, 8, 20, 0.95)",
        borderRight: "1px solid rgba(16, 185, 129, 0.4)",
      },
      ".cm-selectionBackground": {
        backgroundColor: "rgba(16, 185, 129, 0.25)",
      },
    }),
  },
  {
    id: "hacker",
    label: "Hacker",
    theme: applySyntaxColors(
      createThemeVariant({
        "&": {
          backgroundImage: "linear-gradient(160deg, #020802, #001316 60%, #051c11)",
          color: "#b4f0be",
        },
        ".cm-gutters": {
          backgroundColor: "rgba(0, 12, 0, 0.95)",
          borderRight: "1px solid rgba(16, 185, 129, 0.5)",
        },
        ".cm-selectionBackground": {
          backgroundColor: "rgba(16, 185, 129, 0.35)",
        },
      }),
      {
        mainKeyword: "#41ff00",
        waveform: "#7ef9ff",
        gain: "#79ff4d",
        param: "#51e1ff",
        nameBg: "#021701",
      },
    ),
  },
  {
    id: "contrast",
    label: "Contrast",
    theme: applySyntaxColors(
      createThemeVariant({
        "&": {
          backgroundImage: "linear-gradient(180deg, #000000, #0b0b0b)",
          color: "#ffffff",
        },
        ".cm-gutters": {
          backgroundColor: "#000000",
          borderRight: "1px solid #f97316",
        },
        ".cm-selectionBackground": {
          backgroundColor: "rgba(14, 165, 233, 0.4)",
          boxShadow: "0 0 20px rgba(14, 165, 233, 0.35)",
        },
      }),
      {
        mainKeyword: "#fb923c",
        waveform: "#06b6d4",
        gain: "#f97316",
        param: "#22d3ee",
        nameBg: "#000000",
      },
    ),
  },
  {
    id: "industrial",
    label: "Industrial",
    theme: applySyntaxColors(
      createThemeVariant({
        "&": {
          backgroundColor: "#090909",
          color: "#d9d9d9",
          backgroundImage: "linear-gradient(180deg, #111111, #040404 60%)",
        },
        ".cm-gutters": {
          backgroundColor: "#0e0e0e",
          borderRight: "1px solid #4b5563",
        },
        ".cm-selectionBackground": {
          backgroundColor: "#1f1b1b",
        },
        ".cm-scroller": {
          fontFamily: "'Space Mono', 'Fira Code', 'JetBrains Mono', monospace",
        },
      }),
      {
        mainKeyword: "#f97316",
        waveform: "#e5e7eb",
        gain: "#d946ef",
        param: "#4dd0e1",
        nameBg: "#050505",
      },
    ),
  },
];

const SYNTAX_VARIATIONS = [
  {
    id: "aurora",
    label: "Aurora",
    colors: {
      mainKeyword: "#fb923c",
      waveform: "#fbbf24",
      gain: "#f472b6",
      param: "#38bdf8",
      nameBg: "#000000",
    },
  },
  {
    id: "mist",
    label: "Mist",
    colors: {
      mainKeyword: "#f97316",
      waveform: "#34d399",
      gain: "#a855f7",
      param: "#67e8f9",
      nameBg: "#050506",
    },
  },
  {
    id: "nocturne",
    label: "Nocturne",
    colors: {
      mainKeyword: "#a5f3fc",
      waveform: "#fde047",
      gain: "#fb7185",
      param: "#5eead4",
      nameBg: "#010204",
    },
  },
];

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
  const [selectedThemeId, setSelectedThemeId] = React.useState(
    THEME_VARIATIONS[0]?.id ?? "nebula",
  );
  const [debugPanelOpen, setDebugPanelOpen] = React.useState(false);

  const activeTheme = React.useMemo(() => {
    return (
      THEME_VARIATIONS.find((v) => v.id === selectedThemeId)?.theme ??
      defaultTheme
    );
  }, [selectedThemeId]);

  const themeExtension = React.useMemo(
    () => EditorView.theme(activeTheme, { dark: true }),
    [activeTheme],
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
        themeOptions={THEME_VARIATIONS.map((variant) => ({
          id: variant.id,
          label: variant.label,
        }))}
        selectedThemeId={selectedThemeId}
        onThemeChange={setSelectedThemeId}
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
