"use client";

import { cn } from "@/lib/utils";
import type {
  AudioDevice,
  GhostwriterSettings,
  GhostwriterSettingsUpdate,
} from "@/types/ghostwriter";
import {
  DEFAULT_TRANSCRIPTION_LANGUAGE,
  DEFAULT_TRANSCRIPTION_LANGUAGES,
  getTranscriptionLanguageLabel,
  getTranscriptionLanguageOption,
  normalizeTranscriptionLanguageSelection,
  toVisibleTranscriptionLanguageCode,
  VISIBLE_TRANSCRIPTION_LANGUAGES,
  type SelectableTranscriptionLanguage,
  type TranscriptionLanguage,
} from "@/types/languages";
import { Globe, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "./modal";

export type SettingsVoiceViewProps = {
  settings: GhostwriterSettings | null;
  onUpdateSettings: (patch: GhostwriterSettingsUpdate) => Promise<void>;
};

export function SettingsVoiceView({
  settings,
  onUpdateSettings,
}: SettingsVoiceViewProps) {
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [defaultDeviceName, setDefaultDeviceName] = useState<string | null>(
    null,
  );

  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");
  const [languageAutoDetectDraft, setLanguageAutoDetectDraft] = useState(false);
  const [languageSelectionDraft, setLanguageSelectionDraft] = useState<
    SelectableTranscriptionLanguage[]
  >([...DEFAULT_TRANSCRIPTION_LANGUAGES]);

  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const smoothedLevel = useRef(0);
  const rafId = useRef<number | null>(null);
  const rawLevel = useRef(0);

  useEffect(() => {
    if (!window.ghostwriter) return;
    window.ghostwriter
      .getAudioDevices()
      .then(setAudioDevices)
      .catch(() => undefined);
    window.ghostwriter
      .getDefaultInputDevice()
      .then(setDefaultDeviceName)
      .catch(() => undefined);
  }, []);

  const tickLevel = useCallback(() => {
    const target = rawLevel.current;
    const alpha = target > smoothedLevel.current ? 0.35 : 0.12;
    smoothedLevel.current += (target - smoothedLevel.current) * alpha;
    setMicLevel(smoothedLevel.current);
    rafId.current = requestAnimationFrame(tickLevel);
  }, []);

  useEffect(() => {
    if (!window.ghostwriter) return;
    const unsub = window.ghostwriter.onMicLevel((level) => {
      rawLevel.current = level;
    });
    return () => {
      unsub();
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      window.ghostwriter?.stopMicTest().catch(() => undefined);
    };
  }, []);

  const configuredLanguage: TranscriptionLanguage =
    settings?.transcriptionLanguage ?? DEFAULT_TRANSCRIPTION_LANGUAGE;

  const configuredLanguageSelection = useMemo(() => {
    const normalized = normalizeTranscriptionLanguageSelection(
      settings?.transcriptionLanguages,
    );
    if (normalized.length > 0) return normalized;
    return [
      configuredLanguage === "auto"
        ? DEFAULT_TRANSCRIPTION_LANGUAGES[0]
        : (toVisibleTranscriptionLanguageCode(configuredLanguage) ??
          DEFAULT_TRANSCRIPTION_LANGUAGES[0]),
    ];
  }, [settings?.transcriptionLanguages, configuredLanguage]);

  const configuredLanguageLabel = useMemo(
    () =>
      configuredLanguage === "auto"
        ? "Auto-detect"
        : formatLanguageSummary(configuredLanguageSelection),
    [configuredLanguage, configuredLanguageSelection],
  );

  const languageOptions = useMemo(
    () =>
      VISIBLE_TRANSCRIPTION_LANGUAGES.filter(
        (language) => language.code !== "auto",
      ) as Array<{
        code: SelectableTranscriptionLanguage;
        label: string;
        flag: string;
      }>,
    [],
  );

  const filteredLanguageOptions = useMemo(() => {
    const query = languageSearch.trim().toLowerCase();
    const base = query
      ? languageOptions.filter((language) =>
          `${language.label} ${language.code}`.toLowerCase().includes(query),
        )
      : languageOptions;

    // Move selected languages to the top of the list.
    const selectedSet = new Set(languageSelectionDraft);
    const selected = base.filter((l) => selectedSet.has(l.code));
    const unselected = base.filter((l) => !selectedSet.has(l.code));
    return { selected, unselected };
  }, [languageOptions, languageSearch, languageSelectionDraft]);

  function openLanguagePicker() {
    const activeLanguage =
      settings?.transcriptionLanguage ?? DEFAULT_TRANSCRIPTION_LANGUAGE;
    const isAuto = activeLanguage === "auto";
    const normalizedFromSettings = normalizeTranscriptionLanguageSelection(
      settings?.transcriptionLanguages,
    );
    const fallbackSelection: SelectableTranscriptionLanguage =
      activeLanguage === "auto"
        ? DEFAULT_TRANSCRIPTION_LANGUAGES[0]
        : (toVisibleTranscriptionLanguageCode(activeLanguage) ??
          DEFAULT_TRANSCRIPTION_LANGUAGES[0]);
    setLanguageAutoDetectDraft(isAuto);
    setLanguageSelectionDraft(
      normalizedFromSettings.length > 0
        ? normalizedFromSettings
        : [fallbackSelection],
    );
    setLanguageSearch("");
    setLanguagePickerOpen(true);
  }

  function toggleLanguageSelection(language: SelectableTranscriptionLanguage) {
    setLanguageSelectionDraft((previous) =>
      previous.includes(language)
        ? previous.filter((code) => code !== language)
        : normalizeTranscriptionLanguageSelection([...previous, language]),
    );
  }

  function removeLanguageSelection(language: SelectableTranscriptionLanguage) {
    setLanguageSelectionDraft((previous) =>
      previous.filter((code) => code !== language),
    );
  }

  async function saveLanguagePicker() {
    const normalizedSelection = normalizeTranscriptionLanguageSelection(
      languageSelectionDraft,
    );
    const fallbackSelection: SelectableTranscriptionLanguage =
      normalizedSelection[0] ?? DEFAULT_TRANSCRIPTION_LANGUAGES[0];
    await onUpdateSettings({
      transcriptionLanguage: languageAutoDetectDraft
        ? "auto"
        : fallbackSelection,
      transcriptionLanguages:
        normalizedSelection.length > 0
          ? normalizedSelection
          : [fallbackSelection],
    });
    setLanguagePickerOpen(false);
  }

  async function startMicTest() {
    if (!window.ghostwriter) return;
    const mic = settings?.selectedMicrophone ?? null;
    await window.ghostwriter.startMicTest(mic);
    setMicTesting(true);
    rawLevel.current = 0;
    smoothedLevel.current = 0;
    rafId.current = requestAnimationFrame(tickLevel);
  }

  async function stopMicTest() {
    if (!window.ghostwriter) return;
    await window.ghostwriter.stopMicTest();
    setMicTesting(false);
    rawLevel.current = 0;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    setMicLevel(0);
  }
  return (
    <div className="flex flex-col divide-y divide-border">
      {/* Languages */}
      <div className="flex items-center justify-between py-5">
        <div>
          <p className="text-sm font-medium text-ink">Languages</p>
          <p className="mt-0.5 text-xs text-muted">{configuredLanguageLabel}</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink transition hover:bg-sidebar hover:cursor-pointer"
          onClick={openLanguagePicker}
        >
          Change
        </button>
      </div>

      {/* Microphone */}
      <div className="py-5">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-ink">Microphone</span>
          <select
            className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 hover:cursor-pointer"
            value={settings?.selectedMicrophone ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onUpdateSettings({
                selectedMicrophone: value === "" ? null : value,
              });
              if (micTesting) stopMicTest();
            }}
          >
            <option value="">
              {defaultDeviceName
                ? `System default (${defaultDeviceName})`
                : "System default (auto-detect)"}
            </option>
            {audioDevices.map((device) => (
              <option key={device.index} value={device.name}>
                {device.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">
            Select which microphone to use for ghosting.
          </span>
        </label>

        {/* Mic test */}
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            className={cn(
              "self-start rounded-lg px-3 py-1.5 text-xs font-medium transition hover:cursor-pointer",
              micTesting
                ? "bg-ember/10 text-ember hover:bg-ember/20"
                : "bg-accent/10 text-accent hover:bg-accent/20",
            )}
            onClick={micTesting ? stopMicTest : startMicTest}
          >
            {micTesting ? "Stop test" : "Test microphone"}
          </button>
          {micTesting && (
            <div className="flex items-center gap-3">
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-border">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
                  style={{
                    width: `${Math.min(100, micLevel * 400)}%`,
                    backgroundColor:
                      micLevel * 400 > 80
                        ? "#d6764b"
                        : micLevel * 400 > 40
                          ? "#e6b94d"
                          : "#2f6f5e",
                  }}
                />
              </div>
              <span className="w-8 text-right font-mono text-[10px] text-muted">
                {Math.round(Math.min(100, micLevel * 400))}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Language picker modal */}
      <Modal
        open={languagePickerOpen}
        onClose={() => setLanguagePickerOpen(false)}
        size="custom"
        showCloseButton={false}
        panelClassName="w-[min(980px,92vw)] rounded-2xl border border-border bg-[#f8f8fa] shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
        zIndex={140}
      >
        <div className="border-b border-border px-6 pb-4 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-3xl font-semibold text-ink">Languages</h3>
              <p className="mt-2 text-sm text-muted">
                Select the languages you want to use with GhostWriter.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink">Auto-detect</span>
              <button
                type="button"
                aria-pressed={languageAutoDetectDraft}
                className="relative inline-flex h-7 w-12 items-center rounded-full bg-border transition hover:cursor-pointer"
                style={{
                  backgroundColor: languageAutoDetectDraft
                    ? "#6944AE"
                    : "#d4d4d4",
                }}
                onClick={() =>
                  setLanguageAutoDetectDraft((previous) => !previous)
                }
              >
                <span
                  className={cn(
                    "inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform",
                    languageAutoDetectDraft
                      ? "translate-x-5"
                      : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-5 p-6">
          <div className="flex min-h-[430px] flex-1 flex-col rounded-xl border border-border bg-white">
            <div className="border-b border-border px-4 py-3">
              {languageAutoDetectDraft && (
                <p className="mb-3 rounded-lg border border-border bg-sidebar px-3 py-2 text-sm text-muted">
                  Auto-detect is on. GhostWriter will detect the language you
                  are speaking.
                </p>
              )}
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border bg-sidebar px-3 py-2",
                  languageAutoDetectDraft && "opacity-60",
                )}
              >
                <Search className="h-4 w-4 text-muted" />
                <input
                  value={languageSearch}
                  onChange={(event) => setLanguageSearch(event.target.value)}
                  placeholder="Search for any language"
                  disabled={languageAutoDetectDraft}
                  className="w-full bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div
              className={cn(
                "max-h-[340px] overflow-y-auto p-3",
                languageAutoDetectDraft && "opacity-50",
              )}
            >
              <div className="grid grid-cols-3 gap-2">
                {filteredLanguageOptions.selected.map((language) => (
                  <button
                    key={language.code}
                    type="button"
                    disabled={languageAutoDetectDraft}
                    onClick={() => toggleLanguageSelection(language.code)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                      languageAutoDetectDraft
                        ? "cursor-not-allowed border-border bg-sidebar text-muted"
                        : "border-[#9b85ff] bg-[#f0ecff] text-ink",
                    )}
                  >
                    <span className="text-base leading-none">
                      {language.flag ?? "🌐"}
                    </span>
                    <span className="truncate font-medium">
                      {language.label}
                    </span>
                  </button>
                ))}
              </div>
              {filteredLanguageOptions.selected.length > 0 &&
                filteredLanguageOptions.unselected.length > 0 && (
                  <div className="my-3 border-t border-border" />
                )}
              <div className="grid grid-cols-3 gap-2">
                {filteredLanguageOptions.unselected.map((language) => (
                  <button
                    key={language.code}
                    type="button"
                    disabled={languageAutoDetectDraft}
                    onClick={() => toggleLanguageSelection(language.code)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                      languageAutoDetectDraft
                        ? "cursor-not-allowed border-border bg-sidebar text-muted"
                        : "border-border bg-sidebar text-muted hover:cursor-pointer hover:border-accent/40 hover:text-ink",
                    )}
                  >
                    <span className="text-base leading-none">
                      {language.flag ?? "🌐"}
                    </span>
                    <span className="truncate font-medium">
                      {language.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="w-[230px] shrink-0">
            <p className="text-base font-semibold text-ink">Selected</p>
            <div className="mt-3 space-y-2">
              {languageAutoDetectDraft ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
                  <Globe className="h-4 w-4 text-muted" />
                  <span className="text-sm text-ink">
                    {languageOptions.length} languages
                  </span>
                </div>
              ) : languageSelectionDraft.length === 0 ? (
                <p className="text-xs text-muted">No languages selected.</p>
              ) : (
                languageSelectionDraft.map((code) => {
                  const language = getTranscriptionLanguageOption(code);
                  return (
                    <div
                      key={code}
                      className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span>{language.flag ?? "🌐"}</span>
                        <span className="text-sm text-ink">
                          {language.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLanguageSelection(code)}
                        className="text-muted transition hover:text-ink hover:cursor-pointer"
                        aria-label={`Remove ${language.label}`}
                      >
                        −
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={saveLanguagePicker}
            disabled={
              !languageAutoDetectDraft && languageSelectionDraft.length === 0
            }
            className="rounded-xl bg-[#2e2a35] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3a3544] disabled:opacity-50 hover:cursor-pointer"
          >
            Save and close
          </button>
        </div>
      </Modal>
    </div>
  );
}

function formatLanguageSummary(codes: SelectableTranscriptionLanguage[]) {
  const normalized = normalizeTranscriptionLanguageSelection(codes);
  if (normalized.length === 0) {
    return getTranscriptionLanguageLabel(DEFAULT_TRANSCRIPTION_LANGUAGES[0]);
  }
  const labels = normalized.map((code) => getTranscriptionLanguageLabel(code));
  if (labels.length <= 2) {
    return labels.join(", ");
  }
  return `${labels[0]}, ${labels[1]} and ${labels.length - 2} more`;
}
