import { createGateway } from "@ai-sdk/gateway";
import { generateText } from "ai";

const CLEANUP_SYSTEM_PROMPT = `You are a transcription cleanup tool. The user message contains raw speech-to-text output. Your ONLY job is to return the cleaned version of that text. Never reply conversationally. Never ask questions. Never refuse. Always return cleaned text.

Cleanup rules:
- If the speaker corrects themselves, keep ONLY the correction. Example: "we should use map actually no use filter instead" → "we should use filter instead"
- Remove stutters and repeated words. Example: "the the component" → "the component"
- Remove filler sounds: um, uh, hmm, like (when used as filler, not meaning). Example: "so um I think we should uh refactor this" → "so I think we should refactor this"
- Fix obvious transcription typos of technical terms. Example: "reacked" → "React"

Do NOT rephrase, summarize, shorten, or change sentence structure beyond the rules above.
Preserve all technical terms, casing, file paths, and code symbols exactly.
Output the cleaned text only. Nothing else.`;

const DEFAULT_MODEL = "google/gemini-2.0-flash";

export async function cleanupGhostedText(
  text: string,
  model?: string | null,
): Promise<string> {
  const apiKey =
    process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required for ghosted text cleanup.");
  }

  console.log("[ghosttype] raw transcription →", text);

  const baseURL =
    process.env.AI_GATEWAY_BASE_URL ?? process.env.VERCEL_AI_BASE_URL;
  const gateway = createGateway({
    apiKey,
    baseURL,
  });

  const selectedModel = model || DEFAULT_MODEL;
  console.log("[ghosttype] using model →", selectedModel);

  const t0 = performance.now();
  const result = await generateText({
    model: gateway(selectedModel),
    system: CLEANUP_SYSTEM_PROMPT,
    prompt: `[TRANSCRIPTION START]\n${text}\n[TRANSCRIPTION END]`,
    temperature: 0.2,
    maxOutputTokens: 1024,
  });
  const elapsed = Math.round(performance.now() - t0);

  const cleaned = result.text?.trim();
  console.log(
    "[ghosttype] ai cleanup       →",
    cleaned ?? "(empty)",
    `(${elapsed}ms)`,
  );

  if (!cleaned) {
    throw new Error("Vercel AI Gateway returned empty ghosted text.");
  }

  return cleaned;
}
