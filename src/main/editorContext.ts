import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { VibeCodeContext } from "./aiGateway";

/**
 * Bundle IDs of known code editors whose window titles we can parse.
 * Maps bundle ID → the app-name suffix typically appended to the window title.
 *
 * Window title format for most VS Code-based editors:
 *   `● filename.ext — folder_name — Editor Name`
 *   `filename.ext — folder_name — Editor Name`
 *
 * For JetBrains:
 *   `project_name – filename.ext`
 */
const EDITOR_BUNDLE_IDS = new Set([
  "com.microsoft.VSCode",
  "com.todesktop.230313mzl4w4u92", // Cursor
  "dev.zed.Zed",
  "com.sublimetext.4",
  "com.sublimetext.3",
  "com.jetbrains.intellij",
  "com.jetbrains.WebStorm",
  "com.jetbrains.pycharm",
  "com.jetbrains.goland",
  "com.jetbrains.rider",
  "com.jetbrains.CLion",
  "com.jetbrains.PhpStorm",
  "com.jetbrains.rubymine",
  "com.jetbrains.AppCode",
  "com.jetbrains.DataGrip",
]);

/** Editor app support folder names under ~/Library/Application Support/ */
const EDITOR_STORAGE_DIRS: Record<string, string> = {
  "com.microsoft.VSCode": "Code",
  "com.todesktop.230313mzl4w4u92": "Cursor",
  "dev.zed.Zed": "Zed",
};

const MAX_FILE_BYTES = 6144; // 6 KB per auto-detected file

/* ────────────────────────────────────────────────────────────────────
 * 1. Get the frontmost window title via AppleScript
 * ──────────────────────────────────────────────────────────────────── */

function getFrontmostWindowTitle(): string | null {
  try {
    const raw = execSync(
      `osascript -e 'tell application "System Events" to get name of front window of (first application process whose frontmost is true)'`,
      { timeout: 1500, encoding: "utf8" },
    );
    return raw.trim() || null;
  } catch {
    return null;
  }
}

function getFrontmostBundleId(): string | null {
  try {
    const raw = execSync(
      `osascript -e 'tell application "System Events" to get bundle identifier of first application process whose frontmost is true'`,
      { timeout: 1500, encoding: "utf8" },
    );
    return raw.trim() || null;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────
 * 2. Parse the window title to extract filename + workspace name
 * ──────────────────────────────────────────────────────────────────── */

type ParsedTitle = {
  fileName: string | null;
  workspaceName: string | null;
};

/**
 * VS Code / Cursor / Zed title format:
 *   `● filename.ext — folder_name — VS Code`
 *   `filename.ext — folder_name — Cursor`
 *   `Page - app — ghosttype — Victor`  (tab label — workspace — profile)
 *
 * The em-dash `—` (U+2014) is the separator VS Code uses between sections.
 * Regular hyphens ` - ` can appear *within* a section (e.g. tab label with
 * parent folder), so we ONLY split on the em-dash.
 */
function parseVSCodeTitle(title: string): ParsedTitle {
  // Strip unsaved / modified indicators (● or •)
  const cleaned = title.replace(/^[●•]\s*/, "").trim();

  // Split ONLY on em-dash (U+2014) — NOT regular hyphens or en-dashes
  const parts = cleaned.split(/\s\u2014\s/).map((s) => s.trim());

  if (parts.length >= 2) {
    // parts[0] = tab label (may include parent folder after ` - `)
    // parts[1] = workspace/folder name
    // parts[2+] = editor name / profile

    // Extract the actual filename from the tab label.
    // VS Code shows: `filename.ext` or `filename - parentFolder` or
    // `filename.ext - parentFolder` depending on duplicate names.
    const tabLabel = parts[0];
    let fileName: string;

    // If tab label contains ` - `, the part before it is the filename
    const hyphenIdx = tabLabel.lastIndexOf(" - ");
    if (hyphenIdx > 0) {
      fileName = tabLabel.slice(0, hyphenIdx).trim();
    } else {
      fileName = tabLabel;
    }

    return {
      fileName: fileName || null,
      workspaceName: parts[1] || null,
    };
  }

  // Single segment — might be just a project name with no file open
  return { fileName: null, workspaceName: parts[0] || null };
}

/**
 * JetBrains title format:
 *   `project_name – filename.ext [path]`
 */
function parseJetBrainsTitle(title: string): ParsedTitle {
  // JetBrains uses en-dash (U+2013) or em-dash as separator
  const parts = title.split(/\s[\u2013\u2014]\s/).map((s) => s.trim());

  if (parts.length >= 2) {
    // JetBrains: project first, then file
    const fileSection = parts[parts.length - 1];
    // Strip path in brackets: `filename.ext [~/project/src]` → `filename.ext`
    const fileName = fileSection.replace(/\s*\[.*\]\s*$/, "").trim();
    return {
      fileName: fileName || null,
      workspaceName: parts[0] || null,
    };
  }

  return { fileName: null, workspaceName: parts[0] || null };
}

function isJetBrainsBundleId(bundleId: string): boolean {
  return bundleId.startsWith("com.jetbrains.");
}

/* ────────────────────────────────────────────────────────────────────
 * 3. Resolve workspace folder from editor storage
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Look up recently opened workspace folders from VS Code / Cursor's
 * `storage.json` and find one whose basename matches the workspace name
 * parsed from the window title.
 */
async function resolveWorkspaceFolder(
  bundleId: string,
  workspaceName: string,
): Promise<string | null> {
  const storageDir = EDITOR_STORAGE_DIRS[bundleId];
  if (!storageDir) return null;

  const home = process.env.HOME;
  if (!home) return null;

  const storagePath = path.join(
    home,
    "Library",
    "Application Support",
    storageDir,
    "storage.json",
  );

  try {
    const data = await fs.readFile(storagePath, "utf8");
    const storage = JSON.parse(data);

    // VS Code stores recently opened items under `openedPathsList`
    const entries: {
      folderUri?: string;
      workspace?: { configPath?: string };
    }[] = storage?.openedPathsList?.entries ?? [];

    for (const entry of entries) {
      const uri = entry.folderUri;
      if (!uri) continue;

      // Convert `file:///Users/...` → `/Users/...`
      let folderPath: string;
      try {
        folderPath = new URL(uri).pathname;
      } catch {
        continue;
      }

      if (path.basename(folderPath) === workspaceName) {
        // Verify the folder still exists
        try {
          await fs.access(folderPath);
          return folderPath;
        } catch {
          continue;
        }
      }
    }
  } catch {
    // storage.json missing or unreadable — try workspace storage fallback
  }

  // Fallback: scan workspaceStorage directories for a matching folder
  try {
    const wsStorageBase = path.join(
      home,
      "Library",
      "Application Support",
      storageDir,
      "User",
      "workspaceStorage",
    );

    const dirs = await fs.readdir(wsStorageBase);

    for (const dir of dirs) {
      const wsJsonPath = path.join(wsStorageBase, dir, "workspace.json");
      try {
        const raw = await fs.readFile(wsJsonPath, "utf8");
        const wsData = JSON.parse(raw);
        const folder = wsData?.folder;
        if (!folder) continue;

        let folderPath: string;
        try {
          folderPath = new URL(folder).pathname;
        } catch {
          continue;
        }

        if (path.basename(folderPath) === workspaceName) {
          try {
            await fs.access(folderPath);
            return folderPath;
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // workspaceStorage not available
  }

  return null;
}

/* ────────────────────────────────────────────────────────────────────
 * 4. Find the file in the workspace
 * ──────────────────────────────────────────────────────────────────── */

async function findFileInWorkspace(
  workspaceFolder: string,
  fileName: string,
): Promise<string | null> {
  // Use `find` to locate the file — fast for typical project sizes.
  // Exclude common heavy directories.
  try {
    const result = execSync(
      `find ${JSON.stringify(workspaceFolder)} -name ${JSON.stringify(fileName)} -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/.next/*" -not -path "*/venv/*" -not -path "*/__pycache__/*" -maxdepth 8 -print -quit 2>/dev/null`,
      { timeout: 3000, encoding: "utf8" },
    );
    const found = result.trim();
    return found || null;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────
 * 5. Read file content (truncated)
 * ──────────────────────────────────────────────────────────────────── */

async function readFileTruncated(filePath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.length > MAX_FILE_BYTES
      ? `${raw.slice(0, MAX_FILE_BYTES)}\n… (truncated)`
      : raw;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────
 * 6. Public API: detect the active editor file
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Automatically detect the currently open file in the frontmost code
 * editor and return its contents as vibe-code context.
 *
 * Returns an empty array if detection fails at any step — this is
 * designed to be best-effort and never block or error.
 */
export async function detectActiveEditorContext(): Promise<VibeCodeContext[]> {
  const bundleId = getFrontmostBundleId();
  if (!bundleId || !EDITOR_BUNDLE_IDS.has(bundleId)) return [];

  const windowTitle = getFrontmostWindowTitle();
  if (!windowTitle) return [];

  console.log("[vibecode] window title →", windowTitle);

  // Parse title based on editor type
  const parsed = isJetBrainsBundleId(bundleId)
    ? parseJetBrainsTitle(windowTitle)
    : parseVSCodeTitle(windowTitle);

  console.log("[vibecode] parsed →", parsed);

  if (!parsed.fileName || !parsed.workspaceName) return [];

  // Resolve workspace folder
  const workspaceFolder = await resolveWorkspaceFolder(
    bundleId,
    parsed.workspaceName,
  );

  if (!workspaceFolder) {
    console.log("[vibecode] workspace folder not resolved");
    return [];
  }

  console.log("[vibecode] workspace →", workspaceFolder);

  // Find the file — if it has an extension, search directly.
  // If it doesn't (VS Code often strips extensions in tab titles),
  // search for common source-file extensions.
  const fileName = parsed.fileName;
  let filePath: string | null = null;

  if (fileName.includes(".")) {
    filePath = await findFileInWorkspace(workspaceFolder, fileName);
  } else {
    // Skip obvious non-file tab names
    const SKIP_TABS = new Set([
      "Welcome",
      "Settings",
      "Extensions",
      "Keyboard Shortcuts",
      "Untitled",
      "Output",
      "Terminal",
      "Problems",
      "Debug Console",
      "Search",
    ]);
    if (SKIP_TABS.has(fileName)) return [];

    // Try common source file extensions
    const EXTENSIONS = [
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".py",
      ".rs",
      ".go",
      ".vue",
      ".svelte",
      ".css",
      ".scss",
      ".html",
      ".json",
      ".md",
      ".yaml",
      ".yml",
      ".toml",
      ".swift",
      ".kt",
      ".java",
      ".rb",
      ".php",
      ".c",
      ".cpp",
      ".h",
    ];
    for (const ext of EXTENSIONS) {
      filePath = await findFileInWorkspace(
        workspaceFolder,
        fileName.toLowerCase() + ext,
      );
      if (filePath) break;
    }
  }

  if (!filePath) {
    console.log("[vibecode] file not found in workspace");
    return [];
  }

  console.log("[vibecode] active file →", filePath);

  // Read contents
  const content = await readFileTruncated(filePath);
  if (!content) return [];

  return [
    {
      filePath,
      label: `${path.basename(filePath)} (auto-detected)`,
      content,
    },
  ];
}
