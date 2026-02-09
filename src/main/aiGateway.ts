import { generateText } from "ai";
import { createGateway } from "@ai-sdk/gateway";

const CLEANUP_SYSTEM_PROMPT = `You are a developer speech transcription cleanup engine.

Your job is NOT to paraphrase.
Your job is to faithfully convert spoken developer language into correct written technical text.

Rules:
- Remove false starts, filler words, and verbal corrections.
- If the speaker corrects themselves, keep ONLY the corrected version.
- Preserve all technical terminology exactly.
- Do NOT simplify or reword technical phrases.

Technical handling rules:
- Preserve programming languages, frameworks, libraries, and tools exactly
  (e.g. React, Next.js, TypeScript, Tailwind, Electron, Node.js, npm, pnpm).
- Preserve camelCase, PascalCase, kebab-case, snake_case, and dot.notation.
- Preserve file paths, file names, and extensions.
- Preserve code-like phrases and symbols when spoken.
- Prefer common developer spellings over natural language.
- When ambiguity exists, choose the most likely developer interpretation.

Formatting rules:
- Output plain text only.
- No emojis.
- No explanations.
- No markdown unless explicitly dictated.
- Do not add or remove content beyond cleanup.

You may fix grammar ONLY if it does not alter technical meaning.

Return only the cleaned ghosted text.`;

const GATEWAY_MODEL = "openai/gpt-5-nano";

export async function cleanupGhostedText(text: string): Promise<string> {
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required for ghosted text cleanup.");
  }

  const baseURL = process.env.AI_GATEWAY_BASE_URL ?? process.env.VERCEL_AI_BASE_URL;
  const gateway = createGateway({
    apiKey,
    baseURL
  });

  const result = await generateText({
    model: gateway(GATEWAY_MODEL),
    system: CLEANUP_SYSTEM_PROMPT,
    prompt: text,
    temperature: 0
  });

  const cleaned = result.text?.trim();
  if (!cleaned) {
    throw new Error("Vercel AI Gateway returned empty ghosted text.");
  }

  return cleaned;
}
