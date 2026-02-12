/**
 * Convex HTTP client for the Electron main process.
 *
 * This lets the main process write directly to Convex without routing
 * through the renderer's React hooks.  Used by the auto-dictionary
 * feature to persist corrections the moment they are detected.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

let client: ConvexHttpClient | null = null;
let currentUserId: string | null = null;

function getClient(): ConvexHttpClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error(
        "NEXT_PUBLIC_CONVEX_URL not set — cannot connect to Convex",
      );
    }
    client = new ConvexHttpClient(url);
  }
  return client;
}

/** Store the authenticated user's Convex ID (sent from the renderer). */
export function setUserId(userId: string | null) {
  currentUserId = userId;
}

export function getUserId(): string | null {
  return currentUserId;
}

/**
 * Persist an auto-dictionary correction directly to Convex.
 * Returns `true` on success, `false` if userId is missing or the call fails.
 */
export async function addAutoCorrectionToConvex(correction: {
  original: string;
  replacement: string;
}): Promise<boolean> {
  if (!currentUserId) {
    console.warn(
      "[convexClient] no userId set — cannot persist auto-correction to Convex",
    );
    return false;
  }

  try {
    const c = getClient();
    await c.mutation(api.dictionary.add, {
      userId: currentUserId as any, // Convex Id<"users"> — the HTTP client serialises this correctly
      word: correction.replacement,
      isCorrection: true,
      misspelling: correction.original,
      autoAdded: true,
    });
    return true;
  } catch (error) {
    console.error(
      "[convexClient] failed to persist auto-correction to Convex:",
      error,
    );
    return false;
  }
}
