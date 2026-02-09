/**
 * Generates a macOS-style squircle dock icon from ghosty-logo.png
 * Uses canvas to apply a superellipse (squircle) mask with transparency.
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "public", "assets");
const inputPath = path.join(assetsDir, "ghosty-logo.png");
const outputPath = path.join(assetsDir, "ghosty-dock.png");

const SIZE = 1024;
const PADDING = Math.round(SIZE * 0.08); // ~5% padding
const ICON_SIZE = SIZE - PADDING * 2; // actual icon area
const RADIUS = ICON_SIZE * 0.225; // macOS squircle corner radius (~22.5%)

// Draw a continuous squircle path (Apple-style rounded rect)
function drawSquirclePath(ctx, x, y, w, h, r) {
  const right = x + w;
  const bottom = y + h;

  ctx.beginPath();
  // Top-left corner
  ctx.moveTo(x + r, y);
  // Top edge -> top-right corner
  ctx.lineTo(right - r, y);
  ctx.bezierCurveTo(right - r * 0.45, y, right, y + r * 0.45, right, y + r);
  // Right edge -> bottom-right corner
  ctx.lineTo(right, bottom - r);
  ctx.bezierCurveTo(
    right,
    bottom - r * 0.45,
    right - r * 0.45,
    bottom,
    right - r,
    bottom,
  );
  // Bottom edge -> bottom-left corner
  ctx.lineTo(x + r, bottom);
  ctx.bezierCurveTo(x + r * 0.45, bottom, x, bottom - r * 0.45, x, bottom - r);
  // Left edge -> top-left corner
  ctx.lineTo(x, y + r);
  ctx.bezierCurveTo(x, y + r * 0.45, x + r * 0.45, y, x + r, y);
  ctx.closePath();
}

async function main() {
  const img = await loadImage(inputPath);
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  // Apply squircle clip mask with padding (icon is centered, smaller than canvas)
  drawSquirclePath(ctx, PADDING, PADDING, ICON_SIZE, ICON_SIZE, RADIUS);
  ctx.clip();

  // Draw the original icon within the padded area
  ctx.drawImage(img, PADDING, PADDING, ICON_SIZE, ICON_SIZE);

  // Save
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Dock icon saved to ${outputPath} (${SIZE}x${SIZE})`);
}

main().catch((err) => {
  console.error("Failed to generate dock icon:", err);
  process.exit(1);
});
