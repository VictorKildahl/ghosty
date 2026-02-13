import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export type LocalTranscript = {
  timestamp: number;
  cleanedText: string;
  wordCount: number;
};

const MAX_ENTRIES = 200;

function storePath() {
  return path.join(app.getPath("userData"), "ghostwriter.transcripts.json");
}

export async function loadLocalTranscripts(): Promise<LocalTranscript[]> {
  try {
    const data = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export async function saveLocalTranscript(entry: LocalTranscript) {
  const transcripts = await loadLocalTranscripts();
  transcripts.unshift(entry);

  // Keep only the most recent entries
  if (transcripts.length > MAX_ENTRIES) {
    transcripts.length = MAX_ENTRIES;
  }

  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(transcripts, null, 2));
}

export async function deleteLocalTranscript(timestamp: number) {
  const transcripts = await loadLocalTranscripts();
  const filtered = transcripts.filter((t) => t.timestamp !== timestamp);
  if (filtered.length === transcripts.length) return; // nothing to delete
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(filtered, null, 2));
}
