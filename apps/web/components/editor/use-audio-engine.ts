import * as React from "react";
import type { CompileResult as CompilerResult } from "@workspace/compiler";

type EngineState = "idle" | "initializing" | "running" | "error";

export type EngineStatus = {
  label: string;
  state: EngineState;
};

type UseAudioEngineResult = {
  engineStatus: EngineStatus;
  ensureEngineRunning: () => void;
  applyPatchToEngine: (patch: CompilerResult["patch"]) => void;
  silence: () => void;
};

export function useAudioEngine(): UseAudioEngineResult {
  const [engineStatus, setEngineStatus] = React.useState<EngineStatus>({
    label: "Idle",
    state: "idle",
  });
  const engineRef = React.useRef<any>(null);
  const builderRef = React.useRef<any>(null);
  const engineStateRef = React.useRef<EngineState>("idle");

  React.useEffect(() => {
    engineStateRef.current = engineStatus.state;
  }, [engineStatus.state]);

  const formatContextLabel = (state?: string) => {
    if (!state) {
      return "Idle";
    }
    return state.charAt(0).toUpperCase() + state.slice(1);
  };

  const updateEngineStatusFromContext = React.useCallback(
    (contextState?: string) => {
      if (contextState === "running") {
        setEngineStatus({ label: "Running", state: "running" });
        engineStateRef.current = "running";
        return;
      }
      if (contextState === "suspended") {
        setEngineStatus({ label: "Suspended", state: "idle" });
        if (engineStateRef.current !== "initializing") {
          engineStateRef.current = "idle";
        }
        return;
      }
      if (contextState === "closed") {
        setEngineStatus({ label: "Closed", state: "error" });
        engineStateRef.current = "error";
        return;
      }
      setEngineStatus({ label: formatContextLabel(contextState), state: "idle" });
      if (engineStateRef.current !== "initializing") {
        engineStateRef.current = "idle";
      }
    },
    [],
  );

  const ensureEngineRunning = React.useCallback(() => {
    const engine = engineRef.current;
    const context = engine?.audioContext;
    if (!context) {
      return;
    }
    if (context.state === "running") {
      updateEngineStatusFromContext("running");
      return;
    }
    engine
      .resume?.()
      .then(() => {
        updateEngineStatusFromContext(engine.audioContext?.state);
      })
      .catch((error: unknown) => {
        console.error("Failed to resume audio engine", error);
        setEngineStatus({ label: "Failed", state: "error" });
        engineStateRef.current = "error";
      });
  }, [updateEngineStatusFromContext]);

  const initAudioEngine = React.useCallback(async () => {
    if (engineStateRef.current === "initializing") {
      return;
    }
    setEngineStatus({
      label: "Initializing…",
      state: "initializing",
    });
    engineStateRef.current = "initializing";
    try {
      const { audioEngine, PatchBuilder } = await import("@workspace/audio");
      await audioEngine.init();
      builderRef.current = new PatchBuilder();
      engineRef.current = audioEngine;
      updateEngineStatusFromContext(audioEngine.audioContext?.state);
    } catch (error) {
      console.error("Audio engine failed to initialize", error);
      setEngineStatus({
        label: "Failed",
        state: "error",
      });
      engineStateRef.current = "error";
    }
  }, [updateEngineStatusFromContext]);

  React.useEffect(() => {
    initAudioEngine();
  }, [initAudioEngine]);

  const applyPatchToEngine = React.useCallback(
    (patch: CompilerResult["patch"]) => {
      if (!patch || !builderRef.current) {
        return;
      }
      try {
        builderRef.current.build(patch);
      } catch (error) {
        console.error("Failed to apply patch", error);
      }
    },
    [],
  );

  const silence = React.useCallback(() => {
    const engine = engineRef.current;
    if (!engine?.silence) {
      return;
    }
    engine.silence();
  }, []);

  return {
    engineStatus,
    ensureEngineRunning,
    applyPatchToEngine,
    silence,
  };
}

