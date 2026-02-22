"use client";

import * as React from "react";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import {
  autocompletion,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { Decoration, EditorView, ViewPlugin, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import syntaxConfig from "./syntax-config.json";

const defaultScript = `--- drone ---
osc bass saw 55 @0.3 detune +3c
osc air sine 110 @0.05
lfo slow sine rate 0.02 depth 200
route slow -> bass.freq

fx lpf filter lowpass freq 800 q 6
fx dist drive 2.2

--- noise ---
osc hiss noise @0.2
fx bpf filter bandpass freq 1200 q 12
`;

type RegexSpec = {
  pattern: string;
  flags: string;
};

type SyntaxStyleConfig = {
  theme: Record<string, Record<string, string>>;
  keywordList: string[];
  keywordAliases: Record<string, string>;
  regex: Record<
    "block" | "osc" | "number" | "macro" | "operator",
    RegexSpec
  >;
};

const { theme, keywordList, keywordAliases, regex } =
  syntaxConfig as SyntaxStyleConfig;

const makeRegex = ({ pattern, flags }: RegexSpec) =>
  new RegExp(pattern, flags);

const editorTheme = EditorView.theme(theme, { dark: true });

const completionKeywords = Array.from(
  new Set([...keywordList, ...Object.keys(keywordAliases)]),
);

const keywordRegex = new RegExp(
  `\\b(${completionKeywords.join("|")})\\b`,
  "g",
);
const oscRegex = makeRegex(regex.osc);
const numberRegex = makeRegex(regex.number);
const macroRegex = makeRegex(regex.macro);
const blockRegex = makeRegex(regex.block);
const operatorRegex = makeRegex(regex.operator);

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
      for (const { from, to } of view.visibleRanges) {
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
        collectMatches(keywordRegex, "cm-dsl-keyword");
        collectMatches(numberRegex, "cm-dsl-number");
        collectMatches(macroRegex, "cm-dsl-macro");
        collectMatches(operatorRegex, "cm-dsl-operator");

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

export function LiveEditor({ initialDoc = defaultScript }: LiveEditorProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const workerRef = React.useRef<Worker | null>(null);
  const requestIdRef = React.useRef(0);
  const debounceRef = React.useRef<number | null>(null);
  const [lastEval, setLastEval] = React.useState<EvalPayload | null>(null);
  const [compileState, setCompileState] = React.useState<
    "idle" | "compiling" | "ok" | "error"
  >("idle");
  const [compileResult, setCompileResult] =
    React.useState<CompileResult | null>(null);

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

    const evalLine = (view: EditorView) => {
      const line = view.state.doc.lineAt(view.state.selection.main.head);
      setLastEval({
        type: "line",
        text: line.text,
        from: line.from,
        to: line.to,
      });
      return true;
    };

    const evalBlock = (view: EditorView) => {
      const range = getBlockRange(view.state, view.state.selection.main.head);
      const text = view.state.doc.sliceString(range.from, range.to);
      setLastEval({
        type: "block",
        text,
        from: range.from,
        to: range.to,
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
        dslHighlight,
        keymap.of([
          {
            key: "Mod-Enter",
            run: evalBlock,
          },
          {
            key: "Shift-Enter",
            run: evalLine,
          },
          {
            key: "Alt-Enter",
            run: evalSelection,
          },
        ]),
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

  return (
    <div className="flex h-full flex-col overflow-hidden border border-neutral-800 bg-background shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-700 bg-neutral-900 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live Editor
        </div>
        <div className="text-xs text-muted-foreground">
          Mod+Enter block · Shift+Enter line · Alt+Enter selection
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
    </div>
  );
}
