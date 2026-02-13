import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export type SnippetEntry = {
  id: string;
  snippet: string;
  expansion: string;
  createdAt: number;
};

function storePath() {
  return path.join(app.getPath("userData"), "ghostwriter.snippets.json");
}

export async function loadSnippets(): Promise<SnippetEntry[]> {
  try {
    const data = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

/**
 * Replace the entire local snippets cache with the given entries.
 * Called by the renderer to keep the local file in sync with Convex
 * so the main-process AI can read it during transcription cleanup.
 */
export async function syncSnippets(entries: SnippetEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(entries, null, 2));
}
