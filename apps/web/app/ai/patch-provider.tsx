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
  analyserNode: AnalyserNode | null;
  initEngine: () => Promise<void>;
  sendPatch: () => Promise<void>;
  silence: () => void;
  startRecording: () => void;
  stopRecording: () => Promise<Blob>;
}

const PatchContext = createContext<PatchContextValue | null>(null);

export function PatchProvider({ children }: { children: React.ReactNode }) {
  const [patch, setPatch] = useState<string>("{}");
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("idle");
  const [engineReady, setEngineReady] = useState(false);
  const [contextState, setContextState] = useState("suspended");
  const [sampleRate, setSampleRate] = useState(0);
  const [workletReady, setWorkletReady] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const engineRef = useRef<{
    resume: () => Promise<void>;
    silence: () => void;
    analyserNode: AnalyserNode | null;
    getDebugStatus: () => {
      contextState: string;
      sampleRate: number;
      workletReady: boolean;
    };
    startRecording: () => void;
    stopRecording: () => Promise<Blob>;
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
      setAnalyserNode(audioEngine.analyserNode);
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

  const silence = useCallback(() => {
    engineRef.current?.silence();
  }, []);

  const startRecording = useCallback(() => {
    engineRef.current?.startRecording();
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    if (!engineRef.current)
      return Promise.reject(new Error("Engine not ready"));
    return engineRef.current.stopRecording();
  }, []);

  useEffect(() => {
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
        analyserNode,
        initEngine,
        sendPatch,
        silence,
        startRecording,
        stopRecording,
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
