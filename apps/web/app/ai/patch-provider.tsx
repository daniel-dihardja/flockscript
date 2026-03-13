"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type EngineStatus = "idle" | "initializing" | "ready" | "error";

interface PatchContextValue {
  patch: string;
  setPatch: (json: string) => void;
  engineStatus: EngineStatus;
  engineReady: boolean;
  contextState: string;
  sampleRate: number;
  workletReady: boolean;
  initEngine: () => Promise<void>;
}

const PatchContext = createContext<PatchContextValue | null>(null);

export function PatchProvider({ children }: { children: React.ReactNode }) {
  const [patch, setPatch] = useState<string>("{}");
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("idle");
  const [engineReady, setEngineReady] = useState(false);
  const [contextState, setContextState] = useState("suspended");
  const [sampleRate, setSampleRate] = useState(0);
  const [workletReady, setWorkletReady] = useState(false);
  const engineRef = useRef<{
    resume: () => Promise<void>;
    getDebugStatus: () => {
      contextState: string;
      sampleRate: number;
      workletReady: boolean;
    };
  } | null>(null);

  const initEngine = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.resume();
      return;
    }
    setEngineStatus("initializing");
    try {
      const { audioEngine } = await import("@workspace/audio");
      await audioEngine.init();
      engineRef.current = audioEngine;
      setEngineStatus("ready");
      setEngineReady(true);
    } catch (err) {
      console.error("Audio engine init failed", err);
      setEngineStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!engineReady) return;
    const tick = () => {
      const s = engineRef.current?.getDebugStatus?.();
      if (s) {
        setContextState(s.contextState);
        setSampleRate(s.sampleRate);
        setWorkletReady(s.workletReady);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [engineReady]);

  return (
    <PatchContext.Provider
      value={{
        patch,
        setPatch,
        engineStatus,
        engineReady,
        contextState,
        sampleRate,
        workletReady,
        initEngine,
      }}
    >
      {children}
    </PatchContext.Provider>
  );
}

export function usePatch(): PatchContextValue {
  const ctx = useContext(PatchContext);
  if (!ctx) throw new Error("usePatch must be used within a PatchProvider");
  return ctx;
}
