import { createGateway } from "@ai-sdk/gateway";
import { generateText } from "ai";

const CLEANUP_BASE_RULES = `You are a transcription cleanup tool. The user message contains raw speech-to-text output. Your ONLY job is to return the cleaned version of that text. Never reply conversationally. Never ask questions. Never refuse. Always return cleaned text.

Cleanup rules:
- If the speaker corrects themselves, keep ONLY the correction. Example: "we should use map actually no use filter instead" → "we should use filter instead"
- Remove stutters and repeated words. Example: "the the component" → "the component"
- Remove filler sounds: um, uh, hmm, like (when used as filler, not meaning). Example: "so um I think we should uh refactor this" → "so I think we should refactor this"
- Fix obvious transcription typos of technical terms. Example: "reacked" → "React"

Do NOT rephrase, summarize, shorten, or change sentence structure beyond the rules above.
Preserve all technical terms, casing, file paths, and code symbols exactly.`;

const STYLE_INSTRUCTIONS: Record<string, string> = {
  formal: `
Writing style: FORMAL
- Use proper capitalization (start of sentences, proper nouns).
- Use full punctuation: periods, commas, question marks, etc.
- Keep complete sentences.`,
  casual: `
Writing style: CASUAL
- Use proper capitalization (start of sentences, proper nouns).
- Use lighter punctuation: keep question marks and apostrophes, but you may omit trailing periods and reduce commas where natural.
- Keep a natural conversational tone.`,
  "very-casual": `
Writing style: VERY CASUAL
- Use all lowercase (no capitalization except for proper nouns like names, places, brands).
- Use minimal punctuation: keep question marks and apostrophes, but omit periods and most commas.
- Keep a relaxed, texting-like tone.`,
};

function buildSystemPrompt(writingStyle?: string | null): string {
  const style =
    STYLE_INSTRUCTIONS[writingStyle ?? "casual"] ?? STYLE_INSTRUCTIONS.casual;
  return `${CLEANUP_BASE_RULES}\n${style}\n\nOutput the cleaned text only. Nothing else.`;
}

const DEFAULT_MODEL = "google/gemini-2.0-flash";

export async function cleanupGhostedText(
  text: string,
  model?: string | null,
  writingStyle?: string | null,
): Promise<string> {
  const apiKey =
    process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required for ghosted text cleanup.");
  }

  console.log("[ghosttype] raw transcription →", text);

  const gateway = createGateway({
    apiKey,
  });

  const selectedModel = model || DEFAULT_MODEL;
  console.log("[ghosttype] using model →", selectedModel);

  const t0 = performance.now();
  const result = await generateText({
    model: gateway(selectedModel),
    system: buildSystemPrompt(writingStyle),
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
