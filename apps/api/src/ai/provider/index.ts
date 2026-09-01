import { config } from "../../config.js";
import type { AIProvider } from "./AIProvider.js";
import { GeminiProvider } from "./gemini.js";

let instance: AIProvider | null = null;

/** Retourne le fournisseur IA sélectionné par AI_PROVIDER. */
export function aiProvider(): AIProvider {
  if (instance) return instance;
  switch (config.AI_PROVIDER) {
    case "gemini":
      instance = new GeminiProvider();
      break;
    // case "openai":   instance = new OpenAIProvider(); break;
    // case "anthropic": instance = new AnthropicProvider(); break;
    default:
      instance = new GeminiProvider();
  }
  return instance;
}

export type { AIProvider } from "./AIProvider.js";
