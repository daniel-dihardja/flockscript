"use client";

import * as React from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { json } from "@codemirror/lang-json";

const darkTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "13px",
      backgroundColor: "#0a0a0a",
      color: "#e4e4e7",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "'JetBrains Mono', 'Fira Mono', monospace",
    },
    ".cm-content": { caretColor: "#ffffff", padding: "12px 0" },
    ".cm-line": { padding: "0 16px" },
    ".cm-cursor": { borderLeftColor: "#ffffff" },
    ".cm-selectionBackground, ::selection": { backgroundColor: "#3f3f46" },
    ".cm-activeLine": { backgroundColor: "#18181b" },
    ".cm-activeLineGutter": { backgroundColor: "#18181b" },
    ".cm-gutters": {
      backgroundColor: "#0a0a0a",
      color: "#52525b",
      borderRight: "1px solid #27272a",
    },
    ".cm-matchingBracket": { color: "#a78bfa", fontWeight: "bold" },
    // JSON token colours
    ".tok-string": { color: "#86efac" },
    ".tok-number": { color: "#fb923c" },
    ".tok-bool": { color: "#a78bfa" },
    ".tok-null": { color: "#a78bfa" },
    ".tok-propertyName": { color: "#7dd3fc" },
    ".tok-punctuation": { color: "#71717a" },
  },
  { dark: true },
);

interface PatchEditorProps {
  initialValue: string;
  /** Called with the parsed JSON object when the user clicks Run or presses Cmd+Enter. */
  onRun: (parsed: unknown) => void;
}

/**
 * A CodeMirror JSON editor with a minimal toolbar that contains a single
 * "Run" button. Cmd/Ctrl+Enter also triggers Run.
 */
export function PatchEditor({ initialValue, onRun }: PatchEditorProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleRun = React.useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const text = view.state.doc.toString();
    try {
      const parsed: unknown = JSON.parse(text);
      setError(null);
      onRun(parsed);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [onRun]);

  React.useEffect(() => {
    if (!hostRef.current) return;

    const runKeymap = keymap.of([
      {
        key: "Mod-Enter",
        run() {
          handleRun();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: initialValue,
      extensions: [basicSetup, json(), darkTheme, runKeymap],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // handleRun ref is stable; initialValue only seeds the document once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the run keymap handler in sync without rebuilding the editor.
  const handleRunRef = React.useRef(handleRun);
  React.useEffect(() => {
    handleRunRef.current = handleRun;
  }, [handleRun]);

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          Visual Patch
        </span>
        <div className="flex-1" />
        <button
          onClick={handleRun}
          className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-violet-500 active:bg-violet-700"
        >
          Run
          <kbd className="ml-0.5 rounded bg-violet-800 px-1 py-0.5 text-[10px] font-normal text-violet-200">
            ⌘↵
          </kbd>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 border-b border-red-900 bg-red-950 px-4 py-2 text-xs text-red-300">
          <span className="font-semibold">JSON error:</span> {error}
        </div>
      )}

      {/* Editor mount */}
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" />
    </div>
  );
}
