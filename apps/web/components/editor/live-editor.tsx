"use client";

import * as React from "react";
import {
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
import { compile, type CompileResult } from "@workspace/compiler";
import { Button } from "@workspace/ui/components/button";
import syntaxConfig from "./syntax-config.json";
import { SAMPLE_CATEGORIES } from "./examples";

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
  regex: Record<
    | "block"
    | "osc"
    | "number"
    | "macro"
    | "operator"
    | "name"
    | "routeSource"
    | "routeTarget",
    RegexSpec
  >;
};

const {
  theme,
  mainKeywords = [],
  keywordList,
  keywordAliases,
  waveforms = [],
  gainTokenPattern,
  regex,
} = syntaxConfig as SyntaxStyleConfig;

const makeRegex = ({ pattern, flags }: RegexSpec) => new RegExp(pattern, flags);
const escapeForRegex = (value: string) =>
  value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

const editorTheme = EditorView.theme(theme, { dark: true });

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

const oscRegex = makeRegex(regex.osc);
const numberRegex = makeRegex(regex.number);
const macroRegex = makeRegex(regex.macro);
const blockRegex = makeRegex(regex.block);
const operatorRegex = makeRegex(regex.operator);
const nameRegex = makeRegex(regex.name);
const routeSourceRegex = makeRegex(regex.routeSource);
const routeTargetRegex = makeRegex(regex.routeTarget);
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

type CompileResult = {
  ok: boolean;
  diagnostics: Diagnostic[];
  patch?: {
    oscillators: Array<Record<string, unknown>>;
    modulators: Array<Record<string, unknown>>;
    effects: Array<Record<string, unknown>>;
    routing: Array<Record<string, unknown>>;
  };
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
  const builderRef = React.useRef<any>(null);
  const engineRef = React.useRef<any>(null);
  const [lastEval, setLastEval] = React.useState<EvalPayload | null>(null);
  const [compileState, setCompileState] = React.useState<
    "idle" | "compiling" | "ok" | "error"
  >("idle");
  const [compileResult, setCompileResult] =
    React.useState<CompileResult | null>(null);
  const [engineStatus, setEngineStatus] = React.useState<{
    label: string;
    state: "idle" | "initializing" | "running" | "error";
  }>({ label: "Audio engine idle", state: "idle" });
  const [debugPatch, setDebugPatch] = React.useState<
    CompileResult["patch"] | null
  >(null);
  const [selectedCategory, setSelectedCategory] = React.useState(
    SAMPLE_CATEGORIES[0].name,
  );
  const [selectedSampleIndex, setSelectedSampleIndex] = React.useState(0);

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
        diagnostics: Diagnostic[];
        patch?: CompileResult["patch"];
      };
      if (payload.id !== requestIdRef.current) {
        return;
      }
      setCompileResult({
        ok: payload.ok,
        diagnostics: payload.diagnostics,
        patch: payload.patch,
      });
      setCompileState(payload.ok ? "ok" : "error");
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
        editorTheme,
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

  const currentCategory =
    SAMPLE_CATEGORIES.find((cat) => cat.name === selectedCategory) ??
    SAMPLE_CATEGORIES[0];
  const currentSample =
    currentCategory.samples[selectedSampleIndex] ?? currentCategory.samples[0];

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
    window.requestAnimationFrame(() => {
      viewRef.current?.dispatch({
        effects: highlightEffect.of(null),
      });
    });
  };

  const applyPatchToEngine = (patch: CompileResult["patch"]) => {
    if (!patch || !builderRef.current) {
      return;
    }
    try {
      builderRef.current.build(patch);
    } catch (error) {
      console.error("Failed to apply patch", error);
    }
  };

  function executeRange(
    view: EditorView,
    range: { from: number; to: number },
    kind: EvalPayload["type"],
  ) {
    const raw = view.state.doc.sliceString(range.from, range.to);
    const text = raw.trim();
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

    const normalizedCommand = text.toLowerCase();
    if (normalizedCommand === "sil" || normalizedCommand === "silence") {
      engineRef.current?.silence?.();
      const silenceResult: CompileResult = {
        ok: true,
        diagnostics: [],
        patch: {
          oscillators: [],
          modulators: [],
          effects: [],
          routing: [],
        },
      };
      setCompileResult(silenceResult);
      setCompileState("ok");
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

  const initAudioEngine = async () => {
    if (engineStatus.state === "initializing") {
      return;
    }
    setEngineStatus({
      label: "Initializing audio engine…",
      state: "initializing",
    });
    try {
      const { audioEngine, PatchBuilder } = await import("@workspace/audio");
      await audioEngine.init();
      builderRef.current = new PatchBuilder();
      engineRef.current = audioEngine;
      const engineState = audioEngine.audioContext?.state ?? "unknown";
      setEngineStatus({
        label: `Audio engine ${engineState}`,
        state: "running",
      });
    } catch (error) {
      console.error("Audio engine failed to initialize", error);
      setEngineStatus({
        label: "Audio engine failed",
        state: "error",
      });
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden border border-neutral-800 bg-background shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-700 bg-neutral-900 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live Editor
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="font-semibold"
            onClick={initAudioEngine}
            disabled={engineStatus.state === "initializing"}
          >
            {engineStatus.state === "running"
              ? "Engine running"
              : "Init audio engine"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="font-semibold"
            onClick={runLine}
            disabled={engineStatus.state !== "running"}
          >
            Run line (Cmd+Enter)
          </Button>
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
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <label className="flex flex-col text-[10px] uppercase tracking-widest text-muted-foreground">
            Category
            <select
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              {SAMPLE_CATEGORIES.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-[10px] uppercase tracking-widest text-muted-foreground">
            Sample
            <select
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
              value={selectedSampleIndex}
              onChange={(event) =>
                setSelectedSampleIndex(Number(event.target.value))
              }
            >
              {currentCategory.samples.map((sample, index) => (
                <option key={sample.label} value={index}>
                  {sample.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="text-xs text-muted-foreground">
          Cmd+Enter line · Shift+Enter block · Alt+Enter selection
        </div>
      </div>
      <div className="min-h-0 flex-1" ref={hostRef} />
      <div className="border-t border-neutral-700 bg-neutral-900 px-4 py-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-foreground">
            {compileState === "compiling" && "Compiling"}
            {compileState === "ok" && "Compiled"}
            {compileState === "error" && "Compile error"}
            {compileState === "idle" && "Idle"}
          </span>
          <span className="text-muted-foreground">
            {compileResult
              ? `${compileResult.diagnostics.length} diagnostics`
              : "No diagnostics"}
          </span>
          <span className="text-muted-foreground">
            {compileResult?.patch
              ? `${compileResult.patch.oscillators.length} osc, ${compileResult.patch.modulators.length} lfo, ${compileResult.patch.effects.length} fx`
              : "No patch"}
          </span>
          <span className="flex-1 truncate">
            {lastEval
              ? `${lastEval.type}: ${lastEval.text}`
              : "No evaluation yet"}
          </span>
      </div>
    </div>
    <div className="border-t border-neutral-700 bg-[#070b1a] px-4 py-3 text-xs text-muted-foreground">
      <div className="flex items-center justify-between text-[11px] text-foreground uppercase tracking-[0.35em]">
        <span>Compiled patch</span>
        <span className="text-[10px] text-muted-foreground">
          {debugPatch ? "latest block" : "no patch yet"}
        </span>
      </div>
      <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded border border-neutral-800 bg-[#0c111c] p-3 text-[11px] font-mono text-[#f8fafc]">
        {debugPatch ? JSON.stringify(debugPatch, null, 2) : "No compiled patch available"}
      </pre>
    </div>
  </div>
);
}
