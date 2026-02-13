import { app } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type VibeCodeFile = {
  id: string;
  filePath: string;
  /** Short display label derived from the file name. */
  label: string;
  addedAt: number;
};

function storePath() {
  return path.join(app.getPath("userData"), "ghostwriter.vibecode-files.json");
}

export async function loadVibeCodeFiles(): Promise<VibeCodeFile[]> {
  try {
    const data = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

async function saveVibeCodeFiles(files: VibeCodeFile[]): Promise<void> {
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(files, null, 2));
}

export async function addVibeCodeFile(filePath: string): Promise<VibeCodeFile> {
  const files = await loadVibeCodeFiles();

  // Avoid duplicates by path
  const existing = files.find((f) => f.filePath === filePath);
  if (existing) return existing;

  const entry: VibeCodeFile = {
    id: randomUUID(),
    filePath,
    label: path.basename(filePath),
    addedAt: Date.now(),
  };

  files.push(entry);
  await saveVibeCodeFiles(files);
  return entry;
}

export async function removeVibeCodeFile(id: string): Promise<void> {
  const files = await loadVibeCodeFiles();
  const filtered = files.filter((f) => f.id !== id);
  if (filtered.length === files.length) return;
  await saveVibeCodeFiles(filtered);
}

/**
 * Read the contents of all tagged vibe-code files.
 * Files that no longer exist or are unreadable are silently skipped.
 * Each file is truncated to ~4 KB to keep the prompt manageable.
 */
const MAX_FILE_BYTES = 4096;

export async function readVibeCodeFileContents(): Promise<
  { filePath: string; label: string; content: string }[]
> {
  const files = await loadVibeCodeFiles();
  const results: { filePath: string; label: string; content: string }[] = [];

  for (const file of files) {
    try {
      const raw = await fs.readFile(file.filePath, "utf8");
      const content =
        raw.length > MAX_FILE_BYTES
          ? `${raw.slice(0, MAX_FILE_BYTES)}\n… (truncated)`
          : raw;
      results.push({ filePath: file.filePath, label: file.label, content });
    } catch {
      // File may have been deleted or moved – skip silently
    }
  }

  return results;
}
