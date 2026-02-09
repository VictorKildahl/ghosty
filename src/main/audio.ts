import { app } from "electron";
import { spawn, execFile, type ChildProcess } from "node:child_process";
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
    path.join(basePath, "resources", ...segments)
  ];
}

function findFirstExisting(paths: string[]) {
  return paths.find((candidate) => fs.existsSync(candidate));
}

function resolveFfmpegBinary() {
  const bundled = findFirstExisting([
    ...resolveBundledPaths("ffmpeg", "ffmpeg"),
    ...resolveBundledPaths("ffmpeg", "bin", "ffmpeg")
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
      }
    );

    proc.on("error", () => resolve([]));
  });
}

export function startRecording(microphone?: string | null): RecordingSession {
  const filePath = path.join(os.tmpdir(), `ghosttype-${Date.now()}.wav`);
  const ffmpegBin = resolveFfmpegBinary();

  const audioInput = microphone ? `:${microphone}` : ":0";

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
    filePath
  ];

  const process = spawn(ffmpegBin, args, {
    stdio: "ignore"
  });

  return { filePath, process };
}

export async function stopRecording(session: RecordingSession): Promise<void> {
  if (session.process.killed || session.process.exitCode !== null) return;
  session.process.kill("SIGINT");
  await once(session.process, "exit");
}
