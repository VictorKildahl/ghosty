import { clipboard } from "electron";
import { spawn } from "node:child_process";

type GhostedTextOptions = {
  autoPaste?: boolean;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function applyGhostedText(
  text: string,
  options: GhostedTextOptions = {}
): Promise<void> {
  clipboard.writeText(text);

  if (options.autoPaste === false) return;

  await delay(40);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("osascript", [
      "-e",
      "tell application \"System Events\" to keystroke \"v\" using command down"
    ]);

    proc.on("error", reject);
    proc.on("exit", () => resolve());
  });
}
