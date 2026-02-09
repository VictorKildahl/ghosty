import { app } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_WHISPER_BIN = "whisper";

function resolveBundledPaths(...segments: string[]) {
  const basePath =
    process.env.GHOSTTYPE_RESOURCES_PATH ??
    (app.isPackaged ? process.resourcesPath : app.getAppPath());
  return [
    path.join(basePath, ...segments),
    path.join(basePath, "resources", ...segments)
  ];
}

function findFirstExisting(paths: string[]) {
  return paths.find((candidate) => fs.existsSync(candidate));
}

export async function transcribeWithWhisper(wavPath: string): Promise<string> {
  const bundledBin = findFirstExisting([
    ...resolveBundledPaths("whisper", "whisper-cli"),
    ...resolveBundledPaths("whisper", "main"),
    ...resolveBundledPaths("whisper", "whisper")
  ]);

  const whisperBin: string =
    process.env.WHISPER_BIN ?? bundledBin ?? DEFAULT_WHISPER_BIN;

  const bundledModel = findFirstExisting([
    ...resolveBundledPaths("whisper", "models", "ggml-base.en.bin"),
    ...resolveBundledPaths("whisper", "models", "ggml-small.en.bin"),
    ...resolveBundledPaths("whisper", "models", "ggml-medium.en.bin"),
    ...resolveBundledPaths("whisper", "models", "ggml-base.bin"),
    ...resolveBundledPaths("whisper", "models", "ggml-small.bin"),
    ...resolveBundledPaths("whisper", "models", "ggml-medium.bin"),
    ...resolveBundledPaths("whisper", "models", "ggml-large-v3-turbo.bin"),
    ...resolveBundledPaths("whisper", "models", "ggml-large-v3.bin"),
    ...resolveBundledPaths("whisper", "models", "ggml-large-v2.bin"),
    ...resolveBundledPaths("whisper", "models", "ggml-large-v1.bin")
  ]);

  const modelPath = process.env.WHISPER_MODEL ?? bundledModel;

  if (!modelPath) {
    const [hintPath] = resolveBundledPaths("whisper", "models");
    throw new Error(
      `WHISPER_MODEL must point to a whisper.cpp model file, or place a model in ${hintPath}.`
    );
  }

  const outputBase = path.join(os.tmpdir(), `ghosttype-whisper-${Date.now()}`);
  const args = [
    "-m",
    modelPath,
    "-f",
    wavPath,
    "-l",
    "en",
    "-of",
    outputBase,
    "-otxt"
  ];

  const whisperProcess = spawn(whisperBin, args, { stdio: "ignore" });
  const code = await new Promise<number>((resolve, reject) => {
    whisperProcess.once("error", reject);
    whisperProcess.once("exit", (exitCode) => resolve(exitCode ?? 0));
  });

  if (code !== 0) {
    throw new Error(`whisper.cpp exited with code ${code}.`);
  }

  const txtPath = `${outputBase}.txt`;
  const transcription = await fsPromises.readFile(txtPath, "utf8");
  await fsPromises.rm(txtPath, { force: true });

  return transcription.replace(/\s+/g, " ").trim();
}
