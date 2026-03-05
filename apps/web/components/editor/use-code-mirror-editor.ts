"use client";

import * as React from "react";
import {
  Compartment,
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
  type Transaction,
} from "@codemirror/state";
import {
  autocompletion,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import syntaxConfig from "./syntax-config.json";

type RegexSpec = {
  pattern: string;
  flags: string;
};

type SyntaxStyleConfig = {
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

const wrapKeyword = (value: string) =>
  `(?<![#A-Za-z0-9_-])${value}(?![A-Za-z0-9_-])`;

const completionKeywords = Array.from(
  new Set([
    ...mainKeywords,
    ...keywordList,
    ...waveforms,
    ...Object.keys(keywordAliases),
  ]),
);

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

export const highlightEffect = StateEffect.define<{ from: number; to: number } | null>();

const highlightField = StateField.define<{ from: number; to: number } | null>({
  create: () => null,
  update(value, tr) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(highlightEffect)) {
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
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
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
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      const shouldRebuild =
        update.docChanged ||
        update.viewportChanged ||
        update.transactions.some((tr: Transaction) =>
          tr.effects.some((effect) => effect.is(highlightEffect)),
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

type UseCodeMirrorEditorOptions = {
  hostRef: React.RefObject<HTMLDivElement | null>;
  initialDoc: string;
  themeExtension: Extension;
  onDocChange: (doc: string) => void;
  onExecuteBlock: (view: EditorView) => boolean;
  onExecuteSelection: (view: EditorView) => boolean;
};

type UseCodeMirrorEditorResult = {
  viewRef: React.RefObject<EditorView | null>;
  themeCompartment: Compartment;
};

export function useCodeMirrorEditor({
  hostRef,
  initialDoc,
  themeExtension,
  onDocChange,
  onExecuteBlock,
  onExecuteSelection,
}: UseCodeMirrorEditorOptions): UseCodeMirrorEditorResult {
  const viewRef = React.useRef<EditorView | null>(null);
  const themeCompartment = React.useMemo(() => new Compartment(), []);

  const onDocChangeRef = React.useRef(onDocChange);
  const onExecuteBlockRef = React.useRef(onExecuteBlock);
  const onExecuteSelectionRef = React.useRef(onExecuteSelection);
  React.useEffect(() => {
    onDocChangeRef.current = onDocChange;
  }, [onDocChange]);
  React.useEffect(() => {
    onExecuteBlockRef.current = onExecuteBlock;
  }, [onExecuteBlock]);
  React.useEffect(() => {
    onExecuteSelectionRef.current = onExecuteSelection;
  }, [onExecuteSelection]);

  React.useEffect(() => {
    if (!hostRef.current || viewRef.current) {
      return;
    }

    const runBlock = (view: EditorView) => onExecuteBlockRef.current(view);
    const runSelection = (view: EditorView) => onExecuteSelectionRef.current(view);

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
          { key: "Mod-Enter", run: runBlock },
          { key: "Shift-Enter", run: runBlock },
          { key: "Alt-Enter", run: runSelection },
        ]),
        EditorView.domEventHandlers({
          keydown(event, view) {
            if (event.key === "Enter") {
              if (event.shiftKey && !event.metaKey && !event.ctrlKey) {
                if (runBlock(view)) {
                  event.preventDefault();
                  return true;
                }
                return false;
              }
              if (event.metaKey || (event.ctrlKey && !event.metaKey)) {
                if (runBlock(view)) {
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
            onDocChangeRef.current(update.state.doc.toString());
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

    onDocChangeRef.current(state.doc.toString());

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [hostRef, initialDoc, themeCompartment, themeExtension]);

  React.useEffect(() => {
    if (!viewRef.current) {
      return;
    }
    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(themeExtension),
    });
  }, [themeExtension, themeCompartment]);

  return { viewRef, themeCompartment };
}
