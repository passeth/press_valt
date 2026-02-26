import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry } from "ai";

/**
 * Default AI provider registry using environment API keys.
 * Used as fallback when user hasn't configured their own keys.
 */
export const registry = createProviderRegistry({
  anthropic,
  openai: createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }),
});

/**
 * Create a provider instance using user's own API key.
 * Called from route handlers when generating content.
 */
export function createUserProvider(
  provider: "openai" | "anthropic",
  apiKey: string
) {
  if (provider === "openai") {
    return createOpenAI({ apiKey });
  }
  // Anthropic SDK reads from env by default;
  // for user keys we create a custom instance
  return createOpenAI({
    apiKey,
    baseURL: "https://api.anthropic.com/v1",
  });
}

/**
 * Get the model identifier for a given provider.
 */
export function getDefaultModel(provider: "openai" | "anthropic"): string {
  return provider === "openai" ? "gpt-4o" : "claude-sonnet-4-5-20250514";
}
