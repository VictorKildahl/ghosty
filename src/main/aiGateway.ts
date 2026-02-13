import { createGateway } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { DEFAULT_AI_MODEL, getModelPricing } from "../../types/models";
import type { DictionaryEntry } from "./dictionaryStore";
import type { SnippetEntry } from "./snippetStore";

export type VibeCodeContext = {
  filePath: string;
  label: string;
  content: string;
};

export type TokenUsageInfo = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number; // USD
};

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getModelPricing(model);
  if (!pricing) return 0;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

const CLEANUP_BASE_RULES = `You are a transcription cleanup tool. The user message contains raw speech-to-text output. Your ONLY job is to return the cleaned version of that text. Never reply conversationally. Never ask questions. Never refuse. Always return cleaned text.

Cleanup rules:
- If the speaker corrects themselves, keep ONLY the correction. Example: "we should use map actually no use filter instead" → "we should use filter instead"
- Remove stutters and repeated words. Example: "the the component" → "the component"
- Remove filler sounds: um, uh, hmm, like (when used as filler, not meaning). Example: "so um I think we should uh refactor this" → "so I think we should refactor this"
- Fix obvious transcription typos of technical terms. Example: "reacked" → "React"
- Add punctuation and sentence boundaries where clearly implied by the speech.
- Add paragraph breaks/newlines when the speaker shifts topic or starts a new thought.

Do NOT rephrase, summarize, shorten, or change sentence structure beyond the rules above.
Preserve all technical terms, casing, file paths, and code symbols exactly.`;

const VIBE_CODE_RULES = `You are a transcription cleanup tool specialised for SOFTWARE DEVELOPMENT. The user message contains raw speech-to-text output spoken while the user is coding. Your ONLY job is to return the cleaned version of that text. Never reply conversationally. Never ask questions. Never refuse. Always return cleaned text.

Cleanup rules:
- If the speaker corrects themselves, keep ONLY the correction.
- Remove stutters and repeated words.
- Remove filler sounds: um, uh, hmm, like (when used as filler, not meaning).
- Fix obvious transcription typos of technical terms.
- Add punctuation and sentence boundaries where clearly implied by the speech.
- Add paragraph breaks/newlines when the speaker shifts topic or starts a new thought.

CODE IDENTIFIER RESOLUTION (critical):
You will be given a list of KNOWN IDENTIFIERS extracted from the user's open source files.
When the speaker says words that sound like a known identifier, you MUST replace them with the EXACT identifier from the list.
This is your highest-priority rule — it overrides general spelling.

Examples of spoken words → correct identifier:
- "handle sign up" or "handle signup" → handleSignUp
- "use state" → useState
- "set current view" → setCurrentView
- "is authenticated" → isAuthenticated
- "on click handler" → onClickHandler
- "get user profile" → getUserProfile
- "my component dot TSX" → MyComponent.tsx

Rules for identifier matching:
- Match case-insensitively: the speaker will say the words in natural speech, but output MUST use the exact casing from the identifier list (camelCase, PascalCase, UPPER_CASE, snake_case, etc.)
- If the speaker says something that could match multiple identifiers, pick the one most relevant to the sentence context.
- When the speaker is clearly dictating code (e.g. "const result equals await fetch"), write it as code with correct identifiers.
- When the speaker is talking ABOUT code in natural language (e.g. "I think we should refactor handle sign up"), keep it as prose but use the correct identifier: "I think we should refactor handleSignUp"

Do NOT rephrase, summarize, shorten, or change sentence structure beyond the rules above.
Do NOT generate code unless the speaker is clearly dictating literal code.
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

/**
 * Extract meaningful identifiers from source code so the LLM has an
 * explicit lookup table instead of having to parse raw file contents.
 * Targets: function/variable/class/type names, imports, exports.
 */
function extractIdentifiers(code: string): string[] {
  const ids = new Set<string>();

  // Match common declaration patterns
  const patterns = [
    // const/let/var name, function name, class name, type/interface name
    /(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g,
    // Arrow functions & object destructuring: `const { name } =` or `const name =`
    /(?:const|let|var)\s+\{\s*([^}]+)\}/g,
    // import names: `import { Foo, Bar } from` or `import Foo from`
    /import\s+(?:type\s+)?(?:\{\s*([^}]+)\}|([A-Za-z_$][\w$]*))/g,
    // export: `export function name`, `export const name`
    /export\s+(?:default\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g,
    // React hooks & handlers: useXxx, handleXxx, onXxx, setXxx
    /\b(use[A-Z][\w]*|handle[A-Z][\w]*|on[A-Z][\w]*|set[A-Z][\w]*)\b/g,
    // Component JSX tags: <ComponentName
    /<([A-Z][\w]*)/g,
    // Type annotations: : TypeName or as TypeName
    /(?::\s*|as\s+)([A-Z][\w]*(?:<[^>]*>)?)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) {
      // Some patterns capture in group 1, some in group 2
      for (let i = 1; i < match.length; i++) {
        const raw = match[i];
        if (!raw) continue;

        // Handle destructured imports/variables: `{ Foo, Bar, baz as qux }`
        if (raw.includes(",")) {
          for (const part of raw.split(",")) {
            const cleaned = part.replace(/\s+as\s+\w+/, "").trim();
            if (
              cleaned &&
              /^[A-Za-z_$][\w$]*$/.test(cleaned) &&
              cleaned.length > 1
            ) {
              ids.add(cleaned);
            }
            // Also capture the alias
            const aliasMatch = part.match(/as\s+([A-Za-z_$][\w$]*)/);
            if (aliasMatch) ids.add(aliasMatch[1]);
          }
        } else {
          // Strip generic type params
          const cleaned = raw.replace(/<[^>]*>$/, "").trim();
          if (
            cleaned &&
            /^[A-Za-z_$][\w$]*$/.test(cleaned) &&
            cleaned.length > 1
          ) {
            ids.add(cleaned);
          }
        }
      }
    }
  }

  // Filter out very common JS keywords that aren't useful identifiers
  const SKIP = new Set([
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "break",
    "return",
    "new",
    "this",
    "true",
    "false",
    "null",
    "undefined",
    "void",
    "typeof",
    "instanceof",
    "in",
    "of",
    "from",
    "as",
    "async",
    "await",
    "try",
    "catch",
    "throw",
    "finally",
    "with",
    "default",
    "delete",
    "import",
    "export",
    "extends",
    "implements",
    "super",
    "yield",
    "static",
    "get",
    "set",
    "constructor",
    "string",
    "number",
    "boolean",
    "any",
    "never",
    "unknown",
    "object",
  ]);

  return [...ids].filter((id) => !SKIP.has(id)).sort();
}

function buildSystemPrompt(
  writingStyle?: string | null,
  dictionary?: DictionaryEntry[],
  snippets?: SnippetEntry[],
  vibeCodeFiles?: VibeCodeContext[],
): string {
  const isVibeCode = vibeCodeFiles && vibeCodeFiles.length > 0;
  const baseRules = isVibeCode ? VIBE_CODE_RULES : CLEANUP_BASE_RULES;

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

  let vibeCodeSection = "";
  if (isVibeCode) {
    // Extract identifiers from all context files into a flat lookup list.
    // We only send identifiers (not full file contents) to keep token usage low.
    const allIdentifiers = new Set<string>();
    for (const f of vibeCodeFiles) {
      for (const id of extractIdentifiers(f.content)) {
        allIdentifiers.add(id);
      }
    }

    const identifierList =
      allIdentifiers.size > 0
        ? `\n\nKNOWN IDENTIFIERS (use EXACT casing when the speaker says something matching):\n${[...allIdentifiers].join(", ")}`
        : "";

    // Include file names for context awareness without the full contents
    const fileList = vibeCodeFiles.map((f) => `- ${f.label} (${f.filePath})`);
    const fileListSection = `\n\nActive source files:\n${fileList.join("\n")}`;

    vibeCodeSection = `${identifierList}${fileListSection}`;
  }

  return `${baseRules}\n${style}${dictionarySection}${snippetSection}${vibeCodeSection}\n\nOutput the cleaned text only. Nothing else.`;
}

export type CleanupResult = {
  text: string;
  tokenUsage: TokenUsageInfo;
};

export async function cleanupGhostedText(
  text: string,
  model?: string | null,
  writingStyle?: string | null,
  dictionary?: DictionaryEntry[],
  snippets?: SnippetEntry[],
  vibeCodeFiles?: VibeCodeContext[],
): Promise<CleanupResult> {
  const apiKey =
    process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is required for ghosted text cleanup.");
  }

  console.log("[ghostwriter] Raw transcription →", text);

  const gateway = createGateway({
    apiKey,
  });

  const selectedModel = model || DEFAULT_AI_MODEL;
  console.log("[ghostwriter] AI model →", selectedModel);

  const t0 = performance.now();
  const result = await generateText({
    model: gateway(selectedModel),
    system: buildSystemPrompt(
      writingStyle,
      dictionary,
      snippets,
      vibeCodeFiles,
    ),
    prompt: `[TRANSCRIPTION START]\n${text}\n[TRANSCRIPTION END]`,
    temperature: 0.2,
    maxOutputTokens: 1024,
  });
  const elapsed = Math.round(performance.now() - t0);

  const cleaned = result.text?.trim();

  // Log token usage for monitoring
  const { inputTokens, outputTokens } = result.usage ?? {};
  const safeInput = inputTokens ?? 0;
  const safeOutput = outputTokens ?? 0;
  const cost = estimateCost(selectedModel, safeInput, safeOutput);
  console.log(
    `[ghostwriter] Token usage → Prompt: ${safeInput}, Completion: ${safeOutput}, Total: ${safeInput + safeOutput}, Est. cost: $${cost.toFixed(6)}`,
  );
  console.log(
    "[ghostwriter] AI output →",
    cleaned ?? "(empty)",
    `(${elapsed}ms)`,
  );

  if (!cleaned) {
    throw new Error("Vercel AI Gateway returned empty ghosted text.");
  }

  return {
    text: cleaned,
    tokenUsage: {
      model: selectedModel,
      inputTokens: safeInput,
      outputTokens: safeOutput,
      estimatedCost: cost,
    },
  };
}
