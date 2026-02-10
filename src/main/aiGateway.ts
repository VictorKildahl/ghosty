import { createGateway } from "@ai-sdk/gateway";
import { generateText } from "ai";
import type { DictionaryEntry } from "./dictionaryStore";
import type { SnippetEntry } from "./snippetStore";

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
  excited: `
Writing style: EXCITED
- Use proper capitalization (start of sentences, proper nouns).
- Use full punctuation: periods, commas, question marks.
- Add exclamation marks where the speaker sounds enthusiastic or positive.
- Keep the energy of the original speech — lean into excitement without inventing new content.`,
};

function buildSystemPrompt(
  writingStyle?: string | null,
  dictionary?: DictionaryEntry[],
  snippets?: SnippetEntry[],
): string {
  const style =
    STYLE_INSTRUCTIONS[writingStyle ?? "casual"] ?? STYLE_INSTRUCTIONS.casual;

  let dictionarySection = "";
  if (dictionary && dictionary.length > 0) {
    const vocabWords: string[] = [];
    const corrections: string[] = [];

    for (const entry of dictionary) {
      if (entry.isCorrection && entry.misspelling) {
        corrections.push(`"${entry.misspelling}" → "${entry.word}"`);
      } else {
        vocabWords.push(`"${entry.word}"`);
      }
    }

    const parts: string[] = [];
    if (vocabWords.length > 0) {
      parts.push(
        `The following are known vocabulary words. Always use the exact spelling and casing shown:\n${vocabWords.join(", ")}`,
      );
    }
    if (corrections.length > 0) {
      parts.push(
        `The following are known misspelling corrections. When the transcription contains the misspelling, replace it with the correct form:\n${corrections.join("\n")}`,
      );
    }

    dictionarySection = `\n\nUser dictionary:\n${parts.join("\n\n")}`;
  }

  let snippetSection = "";
  if (snippets && snippets.length > 0) {
    const mappings = snippets.map((s) => `"${s.snippet}" → "${s.expansion}"`);
    snippetSection = `\n\nSnippet expansion:\nWhen the speaker says one of the following trigger phrases, replace it with the corresponding expansion text. Match the trigger phrase case-insensitively.\n${mappings.join("\n")}`;
  }

  return `${CLEANUP_BASE_RULES}\n${style}${dictionarySection}${snippetSection}\n\nOutput the cleaned text only. Nothing else.`;
}

const DEFAULT_MODEL = "google/gemini-2.0-flash";

export async function cleanupGhostedText(
  text: string,
  model?: string | null,
  writingStyle?: string | null,
  dictionary?: DictionaryEntry[],
  snippets?: SnippetEntry[],
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
    system: buildSystemPrompt(writingStyle, dictionary, snippets),
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
