"use client";

import { json } from "@codemirror/lang-json";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { usePatch } from "./patch-provider";

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "transparent",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--font-mono)",
  },
  ".cm-content": {
    caretColor: "hsl(var(--foreground))",
    padding: "8px 0",
  },
  ".cm-focused": { outline: "none" },
  ".cm-line": { padding: "0 12px" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "hsl(var(--foreground))" },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "hsl(var(--muted))",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid hsl(var(--border))",
    color: "hsl(var(--muted-foreground))",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    color: "#6b7280",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-activeLine": { backgroundColor: "hsl(var(--muted) / 0.3)" },
});

export function JsonEditor() {
  const { patch: value, setPatch: onChange, sendPatch } = usePatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const sendPatchRef = useRef(sendPatch);
  sendPatchRef.current = sendPatch;

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange?.(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([
          ...defaultKeymap,
          indentWithTab,
          {
            key: "Mod-Enter",
            run: () => {
              sendPatchRef.current();
              return true;
            },
          },
        ]),
        json(),
        editorTheme,
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes without re-mounting
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">
        JSON
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" />
    </div>
  );
}
