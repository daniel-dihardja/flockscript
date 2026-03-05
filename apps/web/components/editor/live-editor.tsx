"use client";

import * as React from "react";
import {
  Compartment,
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  autocompletion,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { Decoration, EditorView, ViewPlugin, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { Button } from "@workspace/ui/components/button";
import syntaxConfig from "./syntax-config.json";
import { SAMPLE_CATEGORIES } from "./examples";
import { LiveEditorToolbar } from "./live-editor-toolbar";
import { LiveEditorDebugPanel } from "./live-editor-debug-panel";
import { useAudioEngine } from "./use-audio-engine";
import { useFlockScriptCompiler } from "./use-flockscript-compiler";

const defaultScript = SAMPLE_CATEGORIES[0].samples[0].code;

type RegexSpec = {
  pattern: string;
  flags: string;
};

type SyntaxStyleConfig = {
  theme: Record<string, Record<string, string>>;
  mainKeywords: string[];
  keywordList: string[];
  keywordAliases: Record<string, string>;
  waveforms?: string[];
  gainTokenPattern?: string;
  paramKeywords?: string[];
  regex: Record<
    | "block"
    | "osc"
    | "number"
    | "macro"
    | "operator"
    | "name"
    | "routeSource"
    | "routeTarget"
    | "listName",
    RegexSpec
  >;
};

const {
  theme: defaultTheme,
  mainKeywords = [],
  keywordList,
  keywordAliases,
  waveforms = [],
  gainTokenPattern,
  paramKeywords: configuredParamKeywords = [],
  regex,
} = syntaxConfig as SyntaxStyleConfig;

const fallbackParamKeywords = [
  "frequency",
  "frq",
  "detune",
  "pan",
  "rate",
  "depth",
  "gain",
  "wave",
  "filter",
  "q",
  "offset",
  "env",
];
const paramKeywords =
  configuredParamKeywords.length > 0
    ? configuredParamKeywords
    : fallbackParamKeywords;

const makeRegex = ({ pattern, flags }: RegexSpec) => new RegExp(pattern, flags);
const escapeForRegex = (value: string) =>
  value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

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

const completionKeywords = Array.from(
  new Set([
    ...mainKeywords,
    ...keywordList,
    ...waveforms,
    ...Object.keys(keywordAliases),
  ]),
);

const wrapKeyword = (value: string) =>
  `(?<![#A-Za-z0-9_-])${value}(?![A-Za-z0-9_-])`;

const mainKeywordPattern =
  mainKeywords.length > 0
    ? `(${mainKeywords.map((keyword) => wrapKeyword(escapeForRegex(keyword))).join("|")})`
    : "";
const subKeywordPattern =
  keywordList.length > 0
    ? `(${keywordList.map((keyword) => wrapKeyword(escapeForRegex(keyword))).join("|")})`
    : "";
const mainKeywordRegex = mainKeywordPattern
  ? new RegExp(mainKeywordPattern, "g")
  : null;
const subKeywordRegex = subKeywordPattern
  ? new RegExp(subKeywordPattern, "g")
  : null;
const waveformPattern =
  waveforms.length > 0
    ? `\\b(${waveforms.map(escapeForRegex).join("|")})\\b`
    : "";
const waveformRegex = waveformPattern
  ? new RegExp(waveformPattern, "gi")
  : null;
const gainRegex = gainTokenPattern
  ? new RegExp(gainTokenPattern, "gi")
  : null;
const paramPattern =
  paramKeywords.length > 0
    ? `\\b(${paramKeywords.map(escapeForRegex).join("|")})\\b`
    : "";
const paramRegex = paramPattern ? new RegExp(paramPattern, "gi") : null;

const oscRegex = makeRegex(regex.osc);
const numberRegex = makeRegex(regex.number);
const macroRegex = makeRegex(regex.macro);
const blockRegex = makeRegex(regex.block);
const operatorRegex = makeRegex(regex.operator);
const nameRegex = makeRegex(regex.name);
const routeSourceRegex = makeRegex(regex.routeSource);
const routeTargetRegex = makeRegex(regex.routeTarget);
const listNameRegex = makeRegex(regex.listName);
const highlightEffect = StateEffect.define<{ from: number; to: number } | null>();
const highlightField = StateField.define<{ from: number; to: number } | null>({
  create: () => null,
  update(value, tr) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.spec === highlightEffect) {
        next = effect.value;
      }
    }
    if (next && tr.docChanged) {
      const mappedFrom = tr.changes.mapPos(next.from, -1);
      const mappedTo = tr.changes.mapPos(next.to, 1);
      next = { from: mappedFrom, to: mappedTo };
    }
    return next;
  },
});

const dslHighlight = ViewPlugin.fromClass(
  class {
    decorations: ReturnType<typeof Decoration.set>;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: {
      docChanged: boolean;
      viewportChanged: boolean;
      view: EditorView;
    }) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const rangesToScan =
        view.visibleRanges.length > 0
          ? view.visibleRanges
          : [{ from: 0, to: view.state.doc.length }];
      for (const { from, to } of rangesToScan) {
        const text = view.state.doc.sliceString(from, to);
        const offset = from;
        const ranges: Array<{ from: number; to: number; className: string }> =
          [];

        const collectMatches = (regex: RegExp, className: string) => {
          regex.lastIndex = 0;
          let match = regex.exec(text);
          while (match) {
            const start = offset + match.index;
            const end = start + match[0].length;
            ranges.push({ from: start, to: end, className });
            match = regex.exec(text);
          }
        };

        collectMatches(blockRegex, "cm-dsl-block");
        collectMatches(oscRegex, "cm-dsl-osc");
        if (mainKeywordRegex) {
          collectMatches(mainKeywordRegex, "cm-dsl-main-keyword");
        }
        collectMatches(nameRegex, "cm-dsl-name");
        if (subKeywordRegex) {
          collectMatches(subKeywordRegex, "cm-dsl-sub-keyword");
        }
        if (waveformRegex) {
          collectMatches(waveformRegex, "cm-dsl-waveform");
        }
        if (gainRegex) {
          collectMatches(gainRegex, "cm-dsl-gain");
        }
        collectMatches(numberRegex, "cm-dsl-number");
        collectMatches(macroRegex, "cm-dsl-macro");
        collectMatches(operatorRegex, "cm-dsl-operator");
        collectMatches(routeSourceRegex, "cm-dsl-route-source");
        collectMatches(routeTargetRegex, "cm-dsl-route-target");
        collectMatches(listNameRegex, "cm-dsl-name");
        if (paramRegex) {
          collectMatches(paramRegex, "cm-dsl-param");
        }

        ranges
          .sort((a, b) => a.from - b.from || a.to - b.to)
          .forEach((range) => {
            builder.add(
              range.from,
              range.to,
              Decoration.mark({ class: range.className }),
            );
          });
      }
      return builder.finish();
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

const lastLineHighlight = ViewPlugin.fromClass(
  class {
    decorations: ReturnType<typeof Decoration.set>;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: {
      docChanged: boolean;
      viewportChanged: boolean;
      view: EditorView;
      transactions: any[];
    }) {
      const shouldRebuild =
        update.docChanged ||
        update.viewportChanged ||
        update.transactions.some((tr) =>
          tr.effects.some((effect: any) => effect.spec === highlightEffect),
        );
      if (shouldRebuild) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView) {
      const range = view.state.field(highlightField);
      if (!range) {
        return Decoration.none;
      }
      const builder = new RangeSetBuilder<Decoration>();
      builder.add(
        range.from,
        range.to,
        Decoration.mark({ class: "cm-dsl-last-executed" }),
      );
      return builder.finish();
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

const keywordCompletions: Completion[] = completionKeywords.map((label) => ({
  label,
  type: "keyword",
}));

const waveformCompletions: Completion[] = [
  "sine",
  "sin",
  "saw",
  "square",
  "sqr",
  "triangle",
  "tri",
  "noise",
  "noi",
].map((label) => ({
  label,
  type: "keyword",
}));

const fxTypeCompletions: Completion[] = ["filter", "dist", "delay"].map(
  (label) => ({
    label,
    type: "keyword",
  }),
);

const completionSource = (context: CompletionContext) => {
  const word = context.matchBefore(/[A-Za-z_-]+/);
  if (!word && !context.explicit) {
    return null;
  }

  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const tokens = before.trim().split(/\s+/).filter(Boolean);
  const prev = tokens[tokens.length - 1];
  const prevPrev = tokens[tokens.length - 2];

  let options = keywordCompletions;
  if (prevPrev === "osc") {
    options = waveformCompletions;
  } else if (prevPrev === "fx") {
    options = fxTypeCompletions;
  }

  return {
    from: word ? word.from : context.pos,
    options,
  };
};

type EvalPayload = {
  type: "block" | "line" | "selection";
  text: string;
  from: number;
  to: number;
};

type LiveEditorProps = {
  initialDoc?: string;
};

function isBoundaryLine(text: string) {
  const trimmed = text.trim();
  return trimmed.length === 0 || trimmed.startsWith("---");
}

export const LiveEditor = React.forwardRef(LiveEditorComponent);

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

function selectNextWord(view: EditorView) {
  const doc = view.state.doc;
  let pos = view.state.selection.main.to;
  const currentWord = view.state.wordAt(view.state.selection.main.head);
  if (currentWord && currentWord.to > pos) {
    pos = currentWord.to;
  }
  const isWhitespace = (char: string) => /\s/.test(char);
  while (pos < doc.length && isWhitespace(doc.sliceString(pos, pos + 1))) {
    pos += 1;
  }
  if (pos >= doc.length) {
    return false;
  }
  if (!isWhitespace(doc.sliceString(pos, pos + 1))) {
    const start = pos;
    let end = pos;
    while (end < doc.length && !isWhitespace(doc.sliceString(end, end + 1))) {
      end += 1;
    }
    view.dispatch({
      selection: { anchor: start, head: end },
      scrollIntoView: true,
    });
    return true;
  }
  return false;
}

type LiveEditorHandle = {
  runLine: () => void;
};

function LiveEditorComponent(
  { initialDoc = defaultScript }: LiveEditorProps,
  ref: React.ForwardedRef<LiveEditorHandle>,
) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const workerRef = React.useRef<Worker | null>(null);
  const requestIdRef = React.useRef(0);
  const debounceRef = React.useRef<number | null>(null);
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
  const highlightTimeoutRef = React.useRef<number | null>(null);
  const [selectedCategory, setSelectedCategory] = React.useState(
    SAMPLE_CATEGORIES[0].name,
  );
  const [selectedSampleIndex, setSelectedSampleIndex] = React.useState(0);
  const [selectedThemeId, setSelectedThemeId] = React.useState(
    THEME_VARIATIONS[0].id,
  );
  const [debugPanelOpen, setDebugPanelOpen] = React.useState(false);
  const activeTheme = React.useMemo(() => {
    return (
      THEME_VARIATIONS.find((variant) => variant.id === selectedThemeId)?.theme ??
      defaultTheme
    );
  }, [selectedThemeId]);
const themeCompartment = React.useMemo(() => new Compartment(), []);
const themeExtension = React.useMemo(
  () => EditorView.theme(activeTheme, { dark: true }),
  [activeTheme],
);

  React.useEffect(() => {
    if (!hostRef.current || viewRef.current) {
      return;
    }

    const worker = new Worker(
      new URL("./workers/dsl-worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const payload = event.data as {
        id: number;
        ok: boolean;
        diagnostics: CompilerResult["diagnostics"];
        patch?: CompilerResult["patch"];
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

    const evalSelection = (view: EditorView) => {
      const selection = view.state.selection.main;
      if (selection.from === selection.to) {
        return false;
      }
      const text = view.state.doc.sliceString(selection.from, selection.to);
      setLastEval({
        type: "selection",
        text,
        from: selection.from,
        to: selection.to,
      });
      return true;
    };

    const compileNow = (source: string) => {
      if (!workerRef.current) {
        return;
      }
      requestIdRef.current += 1;
      setCompileState("compiling");
      workerRef.current.postMessage({
        id: requestIdRef.current,
        source,
      });
    };

    const scheduleCompile = (source: string) => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        compileNow(source);
      }, 120);
    };

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        basicSetup,
        themeCompartment.of(themeExtension),
        highlightField,
        dslHighlight,
        lastLineHighlight,
        keymap.of([
          { key: "Tab", run: selectNextWord },
          {
            key: "Mod-Enter",
            run: executeBlock,
          },
          {
            key: "Shift-Enter",
            run: executeBlock,
          },
          {
            key: "Alt-Enter",
            run: evalSelection,
          },
        ]),
        EditorView.domEventHandlers({
          keydown(event, view) {
            if (event.key === "Enter") {
              if (event.shiftKey && !event.metaKey && !event.ctrlKey) {
                const handled = executeBlock(view);
                if (handled) {
                  event.preventDefault();
                  return true;
                }
                return false;
              }
              if (event.metaKey || (event.ctrlKey && !event.metaKey)) {
                const handled = executeBlock(view);
                if (handled) {
                  event.preventDefault();
                  return true;
                }
              }
            }
            return false;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            scheduleCompile(update.state.doc.toString());
          }
        }),
        autocompletion({ override: [completionSource] }),
      ],
    });

    const view = new EditorView({
      state,
      parent: hostRef.current,
    });

    viewRef.current = view;

    compileNow(state.doc.toString());

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      worker.terminate();
      workerRef.current = null;
      view.destroy();
      viewRef.current = null;
    };
  }, [initialDoc]);

  React.useEffect(() => {
    if (!viewRef.current) {
      return;
    }
    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(themeExtension),
    });
  }, [themeExtension, themeCompartment]);

  const categories = React.useMemo(
    () => SAMPLE_CATEGORIES.map((cat) => cat.name),
    [],
  );
  const currentCategory =
    SAMPLE_CATEGORIES.find((cat) => cat.name === selectedCategory) ??
    SAMPLE_CATEGORIES[0];
  const currentSample =
    currentCategory.samples[selectedSampleIndex] ?? currentCategory.samples[0];
  const currentSamplesLabels = React.useMemo(
    () => currentCategory.samples.map((sample) => sample.label),
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
  }, [currentSample]);

  React.useEffect(() => {
    setSelectedSampleIndex(0);
  }, [selectedCategory]);

  const clearLineHighlight = () => {
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
  };

  function executeRange(
    view: EditorView,
    range: { from: number; to: number },
    kind: EvalPayload["type"],
  ) {
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
      const silencePatch: NonNullable<CompilerResult["patch"]> = {
        devices: [],
        routes: [],
      };
      silence();
      const silenceResult: CompilerResult = {
        ok: true,
        diagnostics: [],
        patch: silencePatch,
      };
      setCompileResult(silenceResult);
      setCompileState("ok");
      setLastExecMode("silence");
      setDebugPatch(silencePatch);
      if (viewRef.current) {
        viewRef.current.dispatch(
          setDiagnostics(viewRef.current.state, silenceResult.diagnostics),
        );
      }
      clearLineHighlight();
      return true;
    }

    const result = compile(text);
    setCompileResult(result);
    setCompileState(result.ok ? "ok" : "error");
    setLastExecMode(result.ok ? "compile" : "error");
    if (viewRef.current) {
      viewRef.current.dispatch(
        setDiagnostics(viewRef.current.state, result.diagnostics),
      );
    }
    if (result.ok) {
      applyPatchToEngine(result.patch);
      setDebugPatch(result.patch ?? null);
      clearLineHighlight();
    } else {
      setDebugPatch(null);
    }
    return true;
  };

  function executeLine(view: EditorView) {
    const line = view.state.doc.lineAt(view.state.selection.main.head);
    return executeRange(
      view,
      { from: line.from, to: line.to },
      "line",
    );
  };

  function executeBlock(view: EditorView) {
    const range = getBlockRange(view.state, view.state.selection.main.head);
    return executeRange(view, range, "block");
  };

  const runLine = () => {
    if (!viewRef.current) {
      return;
    }
    executeBlock(viewRef.current);
  };

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
