"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import type PatchBuilderType from "@workspace/audio/src/patch-builder";

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
  sendPatch: () => Promise<void>;
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
  const builderRef = useRef<InstanceType<typeof PatchBuilderType> | null>(null);

  const initEngine = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.resume();
      return;
    }
    setEngineStatus("initializing");
    try {
      const { audioEngine, PatchBuilder } = await import("@workspace/audio");
      await audioEngine.init();
      engineRef.current = audioEngine;
      builderRef.current = new PatchBuilder();
      setEngineStatus("ready");
      setEngineReady(true);
    } catch (err) {
      console.error("Audio engine init failed", err);
      setEngineStatus("error");
    }
  }, []);

  const sendPatch = useCallback(async () => {
    try {
      if (!engineRef.current) {
        await initEngine();
      }
      if (!builderRef.current) return;
      const parsed = JSON.parse(patch);
      builderRef.current.build(parsed);
      await engineRef.current?.resume();
    } catch (err) {
      console.error("Failed to send patch", err);
    }
  }, [initEngine, patch]);

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
        sendPatch,
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
