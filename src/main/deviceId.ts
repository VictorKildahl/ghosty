import { app } from "electron";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEVICE_ID_FILE = "ghostwriter.device-id";

function deviceIdPath() {
  return path.join(app.getPath("userData"), DEVICE_ID_FILE);
}

export async function getDeviceId(): Promise<string> {
  try {
    const id = await fs.readFile(deviceIdPath(), "utf8");
    if (id.trim()) return id.trim();
  } catch {
    // File doesn't exist, create one
  }

  const id = crypto.randomUUID();
  await fs.mkdir(path.dirname(deviceIdPath()), { recursive: true });
  await fs.writeFile(deviceIdPath(), id);
  return id;
}
