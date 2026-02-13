import { app } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type DictionaryEntry = {
  id: string;
  word: string;
  isCorrection: boolean;
  misspelling?: string;
  createdAt: number;
};

function storePath() {
  return path.join(app.getPath("userData"), "ghostwriter.dictionary.json");
}

export async function loadDictionary(): Promise<DictionaryEntry[]> {
  try {
    const data = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export async function addDictionaryEntry(
  entry: Omit<DictionaryEntry, "id" | "createdAt">,
): Promise<DictionaryEntry> {
  const entries = await loadDictionary();

  const newEntry: DictionaryEntry = {
    id: randomUUID(),
    word: entry.word,
    isCorrection: entry.isCorrection,
    ...(entry.isCorrection && entry.misspelling
      ? { misspelling: entry.misspelling }
      : {}),
    createdAt: Date.now(),
  };

  entries.unshift(newEntry);

  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(entries, null, 2));

  return newEntry;
}

export async function deleteDictionaryEntry(id: string): Promise<void> {
  const entries = await loadDictionary();
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length === entries.length) return; // nothing to delete
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(filtered, null, 2));
}

/**
 * Replace the entire local dictionary cache with the given entries.
 * Called by the renderer to keep the local file in sync with Convex
 * so the main-process AI can read it during transcription cleanup.
 */
export async function syncDictionary(
  entries: DictionaryEntry[],
): Promise<void> {
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(entries, null, 2));
}
