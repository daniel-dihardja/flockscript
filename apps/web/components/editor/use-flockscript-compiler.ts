import * as React from "react";
import { EditorView } from "@codemirror/view";
import { setDiagnostics } from "@codemirror/lint";
import { compile, type CompileResult as CompilerResult } from "@workspace/compiler";

type ExecMode = "silence" | "compile" | "error" | null;

type UseFlockScriptCompilerResult = {
  compileState: "idle" | "compiling" | "ok" | "error";
  compileResult: CompilerResult | null;
  debugPatch: CompilerResult["patch"] | null;
  lastExecMode: ExecMode;
  setCompiling: () => void;
  setSilenceResult: (patch: NonNullable<CompilerResult["patch"]>) => void;
  compileAndApply: (
    text: string,
    view: EditorView | null,
    onPatch?: (patch: CompilerResult["patch"]) => void,
  ) => boolean;
};

export function useFlockScriptCompiler(): UseFlockScriptCompilerResult {
  const [compileState, setCompileState] = React.useState<
    "idle" | "compiling" | "ok" | "error"
  >("idle");
  const [compileResult, setCompileResult] =
    React.useState<CompilerResult | null>(null);
  const [debugPatch, setDebugPatch] = React.useState<
    CompilerResult["patch"] | null
  >(null);
  const [lastExecMode, setLastExecMode] = React.useState<ExecMode>(null);

  const setCompiling = React.useCallback(() => {
    setCompileState("compiling");
  }, []);

  const setSilenceResult = React.useCallback(
    (patch: NonNullable<CompilerResult["patch"]>) => {
      const silenceResult: CompilerResult = {
        ok: true,
        diagnostics: [],
        patch,
      };
      setCompileResult(silenceResult);
      setCompileState("ok");
      setLastExecMode("silence");
      setDebugPatch(patch);
    },
    [],
  );

  const compileAndApply = React.useCallback(
    (
      text: string,
      view: EditorView | null,
      onPatch?: (patch: CompilerResult["patch"]) => void,
    ) => {
      const result = compile(text);
      setCompileResult(result);
      setCompileState(result.ok ? "ok" : "error");
      setLastExecMode(result.ok ? "compile" : "error");

      if (view) {
        view.dispatch(
          setDiagnostics(view.state, result.diagnostics as any),
        );
      }

      if (result.ok) {
        if (onPatch && result.patch) {
          onPatch(result.patch);
        }
        setDebugPatch(result.patch ?? null);
      } else {
        setDebugPatch(null);
      }

      return result.ok;
    },
    [],
  );

  return {
    compileState,
    compileResult,
    debugPatch,
    lastExecMode,
    setCompiling,
    setSilenceResult,
    compileAndApply,
  };
}

