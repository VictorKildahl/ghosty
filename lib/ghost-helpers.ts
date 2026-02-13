import type { GhostingShortcut } from "@/types/ghostwriter";

export type GhostLogEntry = {
  timestamp: Date;
  text: string;
};

export function formatShortcut(shortcut: GhostingShortcut | null) {
  if (!shortcut) return "";
  const parts: string[] = [];
  if (shortcut.meta) parts.push("Cmd");
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Opt");
  if (shortcut.shift) parts.push("Shift");
  parts.push(shortcut.key);
  return parts.join(" + ");
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateHeader(date: Date) {
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function groupByDate(entries: GhostLogEntry[]) {
  const groups: { date: string; entries: GhostLogEntry[] }[] = [];
  for (const entry of entries) {
    const dateStr = formatDateHeader(entry.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.date === dateStr) {
      last.entries.push(entry);
    } else {
      groups.push({ date: dateStr, entries: [entry] });
    }
  }
  return groups;
}
