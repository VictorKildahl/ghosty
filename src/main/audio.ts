import { app } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

export function startRecording(): RecordingSession {
  const filePath = path.join(os.tmpdir(), `ghosttype-${Date.now()}.wav`);
  const ffmpegBin = resolveFfmpegBinary();

  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "avfoundation",
    "-i",
    ":0",
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
