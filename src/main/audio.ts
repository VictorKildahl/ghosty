import { app } from "electron";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type AudioDevice = {
  index: number;
  name: string;
};

export type RecordingSession = {
  filePath: string;
  process: ChildProcess;
};

const DEFAULT_FFMPEG_BIN = "ffmpeg";

function resolveBundledPaths(...segments: string[]) {
  const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return [
    path.join(basePath, ...segments),
    path.join(basePath, "resources", ...segments),
  ];
}

function findFirstExisting(paths: string[]) {
  return paths.find((candidate) => fs.existsSync(candidate));
}

function resolveFfmpegBinary() {
  const bundled = findFirstExisting([
    ...resolveBundledPaths("ffmpeg", "ffmpeg"),
    ...resolveBundledPaths("ffmpeg", "bin", "ffmpeg"),
  ]);

  return bundled ?? DEFAULT_FFMPEG_BIN;
}

export function listAudioDevices(): Promise<AudioDevice[]> {
  return new Promise((resolve) => {
    const ffmpegBin = resolveFfmpegBinary();
    const proc = execFile(
      ffmpegBin,
      ["-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
      { timeout: 5000 },
      (_error, _stdout, stderr) => {
        const output = stderr ?? "";
        const devices: AudioDevice[] = [];
        let inAudioSection = false;

        for (const line of output.split("\n")) {
          if (line.includes("AVFoundation audio devices:")) {
            inAudioSection = true;
            continue;
          }
          if (line.includes("AVFoundation video devices:")) {
            inAudioSection = false;
            continue;
          }
          if (inAudioSection) {
            const match = line.match(/\[(\d+)]\s+(.+)$/);
            if (match) {
              devices.push({ index: Number(match[1]), name: match[2].trim() });
            }
          }
        }

        resolve(devices);
      },
    );

    proc.on("error", () => resolve([]));
  });
}

/**
 * Resolve the microphone to use for recording.
 * If a microphone name is provided, verify it still exists in the device list.
 * Falls back to the system default (device :0) when the selected device is
 * no longer available (e.g. headset unplugged).
 */
export async function resolveActiveMicrophone(
  selectedMicrophone: string | null,
): Promise<string | null> {
  if (!selectedMicrophone) return null; // use default

  const devices = await listAudioDevices();
  const stillAvailable = devices.some((d) => d.name === selectedMicrophone);

  if (stillAvailable) return selectedMicrophone;

  console.log(
    `[ghosttype] selected microphone "${selectedMicrophone}" not found, falling back to default`,
  );
  return null;
}

/* ------------------------------------------------------------------ */
/*  macOS default input device detection                              */
/* ------------------------------------------------------------------ */

type SystemProfilerAudioDevice = {
  _name: string;
  coreaudio_default_audio_input_device?: string;
};

type SystemProfilerResult = {
  SPAudioDataType?: SystemProfilerAudioDevice[];
};

let cachedDefaultDevice: { name: string; ts: number } | null = null;
const CACHE_TTL_MS = 300_000; // 5 min – audio devices rarely change mid-session

/** Invalidate the cached default input device so the next call re-queries. */
export function invalidateDefaultDeviceCache() {
  cachedDefaultDevice = null;
}

/**
 * Ask macOS for the **actual** default audio input device name.
 *
 * Uses `system_profiler SPAudioDataType -json` which is available on every Mac
 * without extra tooling.  The result is cached for several minutes so we don't
 * re-spawn on every hotkey press.  Falls back to `null` (which means `:0`)
 * if the query fails for any reason.
 */
export function getDefaultInputDeviceName(): Promise<string | null> {
  if (
    cachedDefaultDevice &&
    Date.now() - cachedDefaultDevice.ts < CACHE_TTL_MS
  ) {
    return Promise.resolve(cachedDefaultDevice.name);
  }

  return new Promise((resolve) => {
    execFile(
      "/usr/sbin/system_profiler",
      ["SPAudioDataType", "-json"],
      { timeout: 5000 },
      (_error, stdout) => {
        try {
          const parsed: SystemProfilerResult = JSON.parse(stdout ?? "{}");
          const devices = parsed.SPAudioDataType ?? [];
          const defaultDev = devices.find(
            (d) => d.coreaudio_default_audio_input_device === "spaudio_yes",
          );
          if (defaultDev) {
            cachedDefaultDevice = { name: defaultDev._name, ts: Date.now() };
            console.log(
              `[ghosttype] macOS default input device: "${defaultDev._name}"`,
            );
            resolve(defaultDev._name);
            return;
          }
        } catch {
          // parse error – fall through
        }
        console.warn(
          "[ghosttype] could not detect macOS default input device, using :0",
        );
        resolve(null);
      },
    );
  });
}

/**
 * Build the `-i` value for ffmpeg avfoundation audio capture.
 *
 * When a device name is known we pass `:<name>` so ffmpeg picks the correct
 * device regardless of index ordering.  When `null` we fall back to `:0`.
 */
function buildAudioInput(microphone: string | null): string {
  return microphone ? `:${microphone}` : ":0";
}

export function startRecording(microphone?: string | null): RecordingSession {
  const filePath = path.join(os.tmpdir(), `ghosttype-${Date.now()}.wav`);
  const ffmpegBin = resolveFfmpegBinary();

  const audioInput = buildAudioInput(microphone ?? null);

  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "avfoundation",
    "-i",
    audioInput,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    "-flush_packets",
    "1",
    filePath,
  ];

  const childProcess = spawn(ffmpegBin, args, {
    // Pipe stdin so we can send 'q' for a graceful shutdown that flushes
    // all buffered audio instead of losing the last words.
    stdio: ["pipe", "ignore", "ignore"],
  });

  return { filePath, process: childProcess };
}

export async function stopRecording(session: RecordingSession): Promise<void> {
  if (session.process.killed || session.process.exitCode !== null) return;

  const exitPromise = once(session.process, "exit");

  // Send 'q' via stdin for a graceful shutdown – ffmpeg will finish encoding
  // and flush all buffered audio before exiting (prevents cutting off the
  // last words).  Fall back to SIGINT if it doesn't exit within 3 seconds.
  if (session.process.stdin && !session.process.stdin.destroyed) {
    session.process.stdin.write("q");
    session.process.stdin.end();
  } else {
    session.process.kill("SIGINT");
  }

  const timeout = setTimeout(() => {
    if (!session.process.killed && session.process.exitCode === null) {
      session.process.kill("SIGINT");
    }
  }, 3000);

  await exitPromise;
  clearTimeout(timeout);
}

/* ------------------------------------------------------------------ */
/*  Microphone level test                                             */
/* ------------------------------------------------------------------ */

export type MicTestSession = {
  stop: () => void;
};

/**
 * Start a mic-level test that continuously reports the RMS audio level
 * (0 – 1) via `onLevel`.  Call the returned `stop()` to end the test.
 *
 * Under the hood we ask ffmpeg to capture from the selected device and
 * output raw 16-bit PCM to stdout so we can measure the amplitude.
 */
export function startMicTest(
  microphone: string | null,
  onLevel: (level: number) => void,
): MicTestSession {
  const ffmpegBin = resolveFfmpegBinary();
  const audioInput = buildAudioInput(microphone);

  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "avfoundation",
    "-i",
    audioInput,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-f",
    "s16le", // raw 16-bit signed little-endian PCM to stdout
    "-",
  ];

  const proc = spawn(ffmpegBin, args, {
    stdio: ["ignore", "pipe", "ignore"],
  });

  proc.stdout!.on("data", (chunk: Buffer) => {
    // Compute RMS of 16-bit signed samples
    let sumSq = 0;
    const sampleCount = Math.floor(chunk.length / 2);
    if (sampleCount === 0) return;

    for (let i = 0; i < sampleCount; i++) {
      const sample = chunk.readInt16LE(i * 2);
      sumSq += sample * sample;
    }

    const rms = Math.sqrt(sumSq / sampleCount) / 32768;
    onLevel(Math.min(1, rms));
  });

  proc.on("error", () => {
    // Silently ignore – test just won't report levels.
  });

  return {
    stop() {
      if (!proc.killed && proc.exitCode === null) {
        proc.kill("SIGINT");
      }
    },
  };
}
