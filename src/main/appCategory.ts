import { execSync } from "node:child_process";

export type AppCategory = "personal" | "work" | "email" | "code" | "other";

/**
 * Known macOS bundle IDs mapped to app categories.
 * Browsers are intentionally categorised as "other" because we can't
 * reliably determine what website is open inside them.
 */
const BUNDLE_CATEGORY: Record<string, AppCategory> = {
  // ── Personal messaging ──────────────────────────────────────────────
  "com.apple.MobileSMS": "personal", // iMessage
  "com.apple.iChat": "personal", // Messages (older macOS)
  "net.whatsapp.WhatsApp": "personal",
  "com.whatsapp.WhatsApp": "personal",
  "org.telegram.desktop": "personal",
  "ru.keepcoder.Telegram": "personal",
  "com.facebook.archon": "personal", // Messenger desktop
  "com.facebook.archon.developerID": "personal",
  "com.hnc.Discord": "personal", // Discord (personal default)
  "com.signalapps.signal-desktop": "personal",
  "jp.naver.line.mac": "personal",
  "com.viber.osx": "personal",

  // ── Work messaging ──────────────────────────────────────────────────
  "com.tinyspeck.slackmacgap": "work", // Slack
  "com.microsoft.teams": "work",
  "com.microsoft.teams2": "work",
  "us.zoom.xos": "work", // Zoom
  "com.loom.desktop": "work",
  "com.linear": "work",
  "com.basecamp.bc3-mac": "work",
  "com.clickup.desktop-app": "work",
  "com.asana.app": "work",

  // ── Email ───────────────────────────────────────────────────────────
  "com.apple.mail": "email",
  "com.microsoft.Outlook": "email",
  "com.readdle.smartemail-macos": "email", // Spark
  "com.superhuman.mail": "email",
  "com.freron.MailMate": "email",
  "com.postbox-inc.postbox": "email",
  "com.airmail.Airmail-Beta": "email",
  "it.bloop.airmail2": "email",
  "com.mimestream.Mimestream": "email",

  // ── Code editors / IDEs ─────────────────────────────────────────────
  "com.microsoft.VSCode": "code",
  "com.todesktop.230313mzl4w4u92": "code", // Cursor
  "dev.zed.Zed": "code",
  "com.sublimetext.4": "code",
  "com.sublimetext.3": "code",
  "com.jetbrains.intellij": "code",
  "com.jetbrains.WebStorm": "code",
  "com.jetbrains.pycharm": "code",
  "com.jetbrains.goland": "code",
  "com.jetbrains.rider": "code",
  "com.jetbrains.CLion": "code",
  "com.jetbrains.PhpStorm": "code",
  "com.jetbrains.rubymine": "code",
  "com.jetbrains.AppCode": "code",
  "com.jetbrains.DataGrip": "code",
  "com.googlecode.iterm2": "code",
  "com.apple.Terminal": "code",
  "net.kovidgoyal.kitty": "code",
  "co.zeit.hyper": "code",
  "com.github.wez.wezterm": "code",
  "dev.warp.Warp-Stable": "code",
};

/**
 * Get the bundle identifier of the macOS frontmost application.
 * Returns `null` if detection fails (non-macOS, sandbox restriction, etc.).
 */
export function getFrontmostBundleId(): string | null {
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

/**
 * Categorise the current frontmost app into one of the four style
 * categories. Defaults to "other" for unrecognised apps.
 */
export function detectAppCategory(): AppCategory {
  const bundleId = getFrontmostBundleId();
  if (!bundleId) return "other";
  return BUNDLE_CATEGORY[bundleId] ?? "other";
}

/**
 * Known bundle IDs → human-readable app names.
 */
const BUNDLE_NAME: Record<string, string> = {
  // Personal messaging
  "com.apple.MobileSMS": "Messages",
  "com.apple.iChat": "Messages",
  "net.whatsapp.WhatsApp": "WhatsApp",
  "com.whatsapp.WhatsApp": "WhatsApp",
  "org.telegram.desktop": "Telegram",
  "ru.keepcoder.Telegram": "Telegram",
  "com.facebook.archon": "Messenger",
  "com.facebook.archon.developerID": "Messenger",
  "com.hnc.Discord": "Discord",
  "com.signalapps.signal-desktop": "Signal",
  "jp.naver.line.mac": "LINE",
  "com.viber.osx": "Viber",

  // Work messaging
  "com.tinyspeck.slackmacgap": "Slack",
  "com.microsoft.teams": "Microsoft Teams",
  "com.microsoft.teams2": "Microsoft Teams",
  "us.zoom.xos": "Zoom",
  "com.loom.desktop": "Loom",
  "com.linear": "Linear",
  "com.basecamp.bc3-mac": "Basecamp",
  "com.clickup.desktop-app": "ClickUp",
  "com.asana.app": "Asana",

  // Email
  "com.apple.mail": "Apple Mail",
  "com.microsoft.Outlook": "Outlook",
  "com.readdle.smartemail-macos": "Spark",
  "com.superhuman.mail": "Superhuman",
  "com.freron.MailMate": "MailMate",
  "com.postbox-inc.postbox": "Postbox",
  "com.airmail.Airmail-Beta": "Airmail",
  "it.bloop.airmail2": "Airmail",
  "com.mimestream.Mimestream": "Mimestream",

  // Browsers
  "com.apple.Safari": "Safari",
  "com.google.Chrome": "Google Chrome",
  "org.mozilla.firefox": "Firefox",
  "com.microsoft.edgemac": "Microsoft Edge",
  "com.brave.Browser": "Brave",
  "company.thebrowser.Browser": "Arc",
  "com.vivaldi.Vivaldi": "Vivaldi",
  "com.operasoftware.Opera": "Opera",

  // Productivity
  "com.apple.Notes": "Notes",
  "com.apple.TextEdit": "TextEdit",
  "md.obsidian": "Obsidian",
  "com.notion.Notion": "Notion",
  "com.electron.logseq": "Logseq",
  "com.microsoft.Word": "Microsoft Word",
  "com.google.drivefs": "Google Docs",
  "com.apple.iWork.Pages": "Pages",

  // Code editors
  "com.microsoft.VSCode": "VS Code",
  "com.todesktop.230313mzl4w4u92": "Cursor",
  "dev.zed.Zed": "Zed",
  "com.sublimetext.4": "Sublime Text",
  "com.jetbrains.intellij": "IntelliJ IDEA",
  "com.googlecode.iterm2": "iTerm2",
  "com.apple.Terminal": "Terminal",
};

/**
 * Derive a human-readable name for the bundle ID.
 * Falls back to a prettified version of the last segment of the ID.
 */
function bundleIdToName(bundleId: string): string {
  if (BUNDLE_NAME[bundleId]) return BUNDLE_NAME[bundleId];
  // Best-effort: take the last dotted component and title-case it
  const parts = bundleId.split(".");
  const last = parts[parts.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1);
}

/**
 * Get a friendly name for the current frontmost macOS application.
 * Returns `"Unknown"` if detection fails.
 */
export function getFrontmostAppName(): string {
  const bundleId = getFrontmostBundleId();
  if (!bundleId) return "Unknown";
  return bundleIdToName(bundleId);
}
