"use client";

import { cn } from "@/lib/utils";
import type { GhosttypeSettings, VibeCodeFile } from "@/types/ghosttype";
import {
  Code2,
  Eye,
  FileCode,
  FolderOpen,
  Pin,
  Plus,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "./page-layout";

export function VibeCodeView() {
  const [settings, setSettings] = useState<GhosttypeSettings | null>(null);
  const [files, setFiles] = useState<VibeCodeFile[]>([]);
  const [showBanner, setShowBanner] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load settings + files
  useEffect(() => {
    if (!window.ghosttype) return;

    window.ghosttype
      .getSettings()
      .then(setSettings)
      .catch(() => undefined);
    window.ghosttype
      .getVibeCodeFiles()
      .then((f) => {
        setFiles(f);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const unsub = window.ghosttype.onSettings(setSettings);
    return unsub;
  }, []);

  const toggleVibeCode = useCallback(async () => {
    if (!window.ghosttype || !settings) return;
    try {
      const next = await window.ghosttype.updateSettings({
        vibeCodeEnabled: !settings.vibeCodeEnabled,
      });
      setSettings(next);
    } catch {
      // ignore
    }
  }, [settings]);

  const handlePickFiles = useCallback(async () => {
    if (!window.ghosttype) return;
    try {
      const added = await window.ghosttype.pickVibeCodeFiles();
      if (added.length > 0) {
        const all = await window.ghosttype.getVibeCodeFiles();
        setFiles(all);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleRemoveFile = useCallback(async (id: string) => {
    if (!window.ghosttype) return;
    try {
      await window.ghosttype.removeVibeCodeFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      // ignore
    }
  }, []);

  const isEnabled = settings?.vibeCodeEnabled ?? false;

  return (
    <PageLayout
      title="Vibe coding"
      subtitle="Automatic codebase context for smarter voice-to-code."
      headerRight={
        <button
          onClick={handlePickFiles}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/90"
        >
          Pin files
        </button>
      }
    >
      {/* Intro banner */}
      {showBanner && (
        <div className="relative mb-6 rounded-2xl bg-parchment/60 px-6 py-5">
          <button
            onClick={() => setShowBanner(false)}
            className="absolute right-4 top-4 rounded-md p-1 text-muted transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            <h2 className="font-serif text-2xl italic text-ink">
              Code at the speed of thought.
            </h2>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/80">
            GhostWriter{" "}
            <span className="font-semibold">
              automatically detects the file you have open
            </span>{" "}
            in VS Code, Cursor, or Zed and uses it as context — so your variable
            names, types, and imports come out right. You can also pin extra
            files (like type definitions) for always-on context.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-ink/70">
              <Eye className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span>
                <strong>Auto-detect:</strong> reads your active editor file
                automatically
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink/70">
              <Pin className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span>
                <strong>Pinned files:</strong> always included as context (e.g.
                shared types)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Enable toggle */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-sidebar/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
            <Code2 className="h-4.5 w-4.5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">
              Enable Vibe Code mode
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Auto-detects your open file and activates when ghosting in code
              editors.
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-pressed={isEnabled}
          className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition hover:cursor-pointer"
          style={{
            backgroundColor: isEnabled ? "#6944AE" : "#d4d4d4",
          }}
          onClick={toggleVibeCode}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
              isEnabled ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>

      {/* Auto-detection info card */}
      <div className="mb-6 rounded-xl border border-border bg-sidebar/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10">
            <Eye className="h-4.5 w-4.5 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">
              Active file detection
            </p>
            <p className="mt-0.5 text-xs text-muted">
              When you ghost in VS Code, Cursor, or Zed, GhostWriter reads the
              window title to detect your open file and includes its contents
              automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Pinned files section */}
      <div className="mb-3 flex items-center gap-2">
        <Pin className="h-3.5 w-3.5 text-muted" />
        <span className="text-sm font-medium text-ink">
          Pinned context files
        </span>
        <span className="text-xs text-muted">
          ({files.length} {files.length === 1 ? "file" : "files"} — always
          included)
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : files.length === 0 ? (
        <button
          type="button"
          onClick={handlePickFiles}
          className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-10 text-muted transition-colors hover:border-accent/40 hover:text-ink/60 hover:cursor-pointer"
        >
          <FolderOpen className="h-7 w-7" />
          <span className="text-sm">
            Pin source files for always-on context (optional)
          </span>
          <span className="text-xs text-muted">
            e.g. shared types, config, API client
          </span>
        </button>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {files.map((file) => (
            <div
              key={file.id}
              className="group flex items-center gap-3 px-4 py-3"
            >
              <FileCode className="h-4 w-4 shrink-0 text-accent/60" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {file.label}
                </p>
                <p className="truncate text-xs text-muted">{file.filePath}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveFile(file.id)}
                className="rounded-md p-1.5 text-muted opacity-0 transition-all hover:bg-ember/10 hover:text-ember group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Add more button at bottom */}
          <button
            type="button"
            onClick={handlePickFiles}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-muted transition-colors hover:text-accent hover:cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Pin more files</span>
          </button>
        </div>
      )}

      {/* How it works callout */}
      <div className="mt-6 rounded-xl bg-accent/5 px-5 py-4">
        <p className="text-xs leading-relaxed text-ink/70">
          <span className="font-semibold text-accent">How it works:</span> When
          you ghost in a code editor, GhostWriter (1) auto-detects your active
          file from the editor window title, and (2) loads any pinned files. All
          context is sent to the AI cleanup step so it can resolve your variable
          names, function signatures, imports, and types — so &quot;use
          state&quot; becomes{" "}
          <code className="ghosttype-code rounded bg-white px-1.5 py-0.5 text-[11px]">
            useState
          </code>{" "}
          and &quot;handle submit&quot; becomes{" "}
          <code className="ghosttype-code rounded bg-white px-1.5 py-0.5 text-[11px]">
            handleSubmit
          </code>
          .
        </p>
      </div>
    </PageLayout>
  );
}
