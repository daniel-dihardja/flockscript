"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import manifest from "@workspace/audio/patches/manifest.json";

type ManifestEntry = {
  name: string;
  category: string;
  file: string;
};

const initialPatch = {
  devices: [
    {
      id: "osc1",
      type: "osc",
      params: {
        wave: "sine",
        frequency: 440,
        gain: 0.5,
      },
    },
    {
      id: "out",
      type: "output",
      params: {
        gain: 1.0,
      },
    },
  ],
  routes: [
    {
      from: "osc1.out",
      to: "out.in",
      signal: "audio",
    },
  ],
};

type EngineDebugStatus = {
  contextState: string;
  sampleRate: number;
  isRunning: boolean;
  useWorklet: boolean;
  workletReady: boolean;
};

export default function AudioTestPage() {
  const [selectedCategory, setSelectedCategory] =
    useState<string>("Single sounds");
  const [selectedPatch, setSelectedPatch] =
    useState<string>("QA 02 - Sine Tone");
  const [editorValue, setEditorValue] = useState<string>(
    JSON.stringify(initialPatch, null, 2),
  );
  const [statusMessage, setStatusMessage] =
    useState<string>("Waiting for input");
  const [isValid, setIsValid] = useState<boolean>(true);
  const [engineStatus, setEngineStatus] = useState<string>(
    "Loading audio engine...",
  );
  const [engineReady, setEngineReady] = useState<boolean>(false);
  const [debugStatus, setDebugStatus] = useState<EngineDebugStatus | null>(
    null,
  );
  const [copySuccess, setCopySuccess] = useState<string>("");

  const engineRef = useRef<any>(null);
  const builderRef = useRef<any>(null);

  useEffect(() => {
    let canceled = false;
    const loadEngine = async () => {
      try {
        setEngineStatus("Initializing audio engine...");
        const { audioEngine, PatchBuilder } = await import("@workspace/audio");
        await audioEngine.init();
        if (canceled) {
          return;
        }
        engineRef.current = audioEngine;
        builderRef.current = new PatchBuilder();
        setEngineReady(true);
        setEngineStatus("Audio engine ready");
        setStatusMessage("Engine ready — patch can be applied");
      } catch (error) {
        console.error("Failed to initialize audio engine", error);
        if (!canceled) {
          setEngineStatus("Failed to load audio engine");
          setStatusMessage("Audio engine unavailable");
        }
      }
    };
    loadEngine();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!engineReady) {
      return undefined;
    }
    const tick = () => {
      const status: EngineDebugStatus | undefined =
        engineRef.current?.getDebugStatus?.();
      if (status) {
        setDebugStatus(status);
      }
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [engineReady]);

  useEffect(() => {
    const entry = manifest.patches.find(
      (patch) => patch.name === selectedPatch,
    );
    if (!entry) {
      return;
    }
    let canceled = false;
    const loadPatch = async () => {
      try {
        setStatusMessage(`Loading ${entry.name}...`);
        setStatusMessage(`Loading ${entry.name}...`);
        const patch = await fetch(
          `/api/patch?file=${encodeURIComponent(entry.file)}`,
        ).then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to load patch (${res.status})`);
          }
          return res.json();
        });
        if (canceled) return;
        setEditorValue(JSON.stringify(patch, null, 2));
        setIsValid(true);
        setStatusMessage(`${entry.name} loaded`);
      } catch (error) {
        console.error("Unable to load patch", error);
        if (!canceled) {
          setStatusMessage("Failed to load patch");
        }
      }
    };
    loadPatch();
    return () => {
      canceled = true;
    };
  }, [selectedPatch]);

  const handleValidate = () => {
    try {
      JSON.parse(editorValue);
      setIsValid(true);
      setStatusMessage("Valid JSON — ready to build");
    } catch (error) {
      setIsValid(false);
      setStatusMessage("Invalid JSON — please fix before building");
    }
  };

  const handleApply = async () => {
    if (!engineReady || !builderRef.current) {
      setStatusMessage("Wait for the engine to initialize");
      return;
    }
    try {
      const patch = JSON.parse(editorValue);
      builderRef.current.build(patch);
      if (engineRef.current?.resume) {
        try {
          await engineRef.current.resume();
        } catch (resumeError) {
          console.warn("Audio context resume blocked", resumeError);
        }
      }
      setStatusMessage("Patch applied — smooth crossfade scheduled");
    } catch (error) {
      console.error(error);
      setStatusMessage("Patch could not be parsed or applied");
      setIsValid(false);
    }
  };

  const categoryGroups = useMemo(() => {
    const buckets: Record<string, ManifestEntry[]> = {};
    manifest.patches.forEach((entry: ManifestEntry) => {
      const bucket = buckets[entry.category] ?? [];
      bucket.push(entry);
      buckets[entry.category] = bucket;
    });
    return Object.entries(buckets).map(([category, entries]) => ({
      category,
      entries,
    }));
  }, []);

  const patchesForCategory = useMemo(() => {
    const bucket = categoryGroups.find(
      (group) => group.category === selectedCategory,
    );
    if (bucket) {
      return bucket.entries;
    }
    return [];
  }, [categoryGroups, selectedCategory]);

  const serializeDebugStatus = (status: EngineDebugStatus | null) => {
    if (!status) return "Engine diagnostics unavailable";
    const entries = [
      ["Context state", status.contextState],
      ["Sample rate", `${status.sampleRate.toFixed(0)} Hz`],
      ["Is running", status.isRunning ? "yes" : "no"],
      ["Worklet enabled", status.useWorklet ? "yes" : "no"],
      ["Worklet ready", status.workletReady ? "yes" : "no"],
    ];
    return entries.map(([label, value]) => `${label}: ${value}`).join("\n");
  };

  const handleCopyDiagnostics = async () => {
    const text = serializeDebugStatus(debugStatus);
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess("Copied");
    } catch (error) {
      console.error("Failed to copy diagnostics", error);
      setCopySuccess("Copy failed");
    }
    setTimeout(() => setCopySuccess(""), 1600);
  };

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-[#00ff00]">
      <div className="flex h-full min-h-screen flex-col px-5 py-6">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            Audio Engine Playground
          </h1>
          <p className="text-sm text-[#8bf08b]">
            Evaluate patches, validate JSON, and live-test the audio engine.
          </p>
        </header>

        <section className="flex flex-col gap-4 rounded-lg bg-[#111] p-5 shadow-lg shadow-black/40">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              className="rounded border border-[#00ff00] px-4 py-2 text-[#00ff00] transition hover:bg-[#00ff00] hover:text-[#0f0f0f]"
              onClick={handleValidate}
            >
              Validate JSON
            </button>
            <button
              type="button"
              className="rounded border border-[#00ff00] px-4 py-2 text-[#00ff00] transition hover:bg-[#00ff00] hover:text-[#0f0f0f]"
              onClick={handleApply}
            >
              Apply to Engine
            </button>
            <div className="flex flex-1 items-center gap-3 rounded border border-[#333] bg-[#050505] px-4 py-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#888]">
                Status
              </span>
              <span className="text-sm font-mono">{statusMessage}</span>
            </div>
          </div>

          <div className="flex w-full gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#888]">
                Patch category
              </label>
              <select
                className="rounded border border-[#00ff00] bg-[#050505] px-3 py-2 text-sm focus:outline-none"
                value={selectedCategory}
                onChange={(event) => {
                  const nextCategory = event.target.value;
                  setSelectedCategory(nextCategory);
                  const firstEntry = categoryGroups.find(
                    (group) => group.category === nextCategory,
                  )?.entries[0];
                  if (firstEntry) {
                    setSelectedPatch(firstEntry.name);
                  }
                }}
              >
                {categoryGroups.map((group) => (
                  <option key={group.category} value={group.category}>
                    {group.category}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[#888]">
                Patch
              </label>
              <select
                className="rounded border border-[#00ff00] bg-[#050505] px-3 py-2 text-sm focus:outline-none"
                value={selectedPatch}
                onChange={(event) => setSelectedPatch(event.target.value)}
              >
                {patchesForCategory.map((entry) => (
                  <option key={entry.name} value={entry.name}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#888]">
              <span>Patch JSON</span>
              <span>{selectedPatch}</span>
            </div>
            <textarea
              id="codeEditor"
              className={`min-h-[280px] flex-1 rounded border-2 border-[#333] bg-[#050505] p-4 font-mono text-sm leading-relaxed ${isValid ? "border-[#00ff00]" : "border-[#ff4d4d]"}`}
              value={editorValue}
              onChange={(event) => setEditorValue(event.target.value)}
            />
          </div>

          <div className="grid gap-2 rounded border border-[#222] bg-[#050505] p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="uppercase tracking-[0.2em] text-[#888]">
                Audio Diagnostics
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">
                  {engineReady ? "engine running" : engineStatus}
                </span>
                <button
                  type="button"
                  className="rounded border border-[#00ff00] px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-[#00ff00] transition hover:bg-[#00ff00] hover:text-[#0f0f0f]"
                  onClick={handleCopyDiagnostics}
                >
                  Copy
                </button>
                {copySuccess ? (
                  <span className="font-mono text-[11px] text-[#8bf08b]">
                    {copySuccess}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="flex justify-between">
                <span>Context state</span>
                <span className="font-mono text-[#8bf08b]">
                  {debugStatus?.contextState ?? "loading"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Sample rate</span>
                <span className="font-mono text-[#8bf08b]">
                  {debugStatus
                    ? `${debugStatus.sampleRate.toFixed(0)} Hz`
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Is running</span>
                <span className="font-mono text-[#8bf08b]">
                  {debugStatus ? (debugStatus.isRunning ? "yes" : "no") : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Worklet enabled</span>
                <span className="font-mono text-[#8bf08b]">
                  {debugStatus ? (debugStatus.useWorklet ? "yes" : "no") : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Worklet ready</span>
                <span className="font-mono text-[#8bf08b]">
                  {debugStatus ? (debugStatus.workletReady ? "yes" : "no") : "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div
              id="validationStatus"
              className={`flex-1 rounded border px-3 py-2 text-sm bg-[#050505] ${
                isValid
                  ? "border-[#00ff00] text-[#00ff00]"
                  : "border-[#ff4d4d] text-[#ff4d4d]"
              }`}
            >
              {statusMessage}
            </div>
            <div id="output" className="text-sm text-[#ff4d4d]">
              Engine output will appear here.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
