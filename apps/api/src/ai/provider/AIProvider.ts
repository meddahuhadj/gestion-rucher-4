/**
 * Couche d'abstraction fournisseur IA — §5 / §2.
 * L'orchestrateur ne dépend QUE de cette interface. Changer de fournisseur
 * = fournir une autre implémentation + AI_PROVIDER=... , sans toucher au reste.
 */

export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  /** Gemini 3.x : signature opaque à renvoyer telle quelle au tour suivant. */
  thoughtSignature?: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** role "assistant" : appels d'outils émis par le modèle */
  toolCalls?: ToolCall[];
  /** role "tool" : nom de l'outil dont `content` est le résultat (JSON) */
  toolName?: string;
};

export type ToolSchema = {
  name: string;
  description: string;
  /** JSON Schema des paramètres */
  parameters: Record<string, unknown>;
};

export type ChatDelta =
  | { type: "text"; value: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      args: Record<string, unknown>;
      thoughtSignature?: string;
    }
  | { type: "usage"; tokensIn: number; tokensOut: number };

export type ChatOptions = {
  model?: string;
  temperature?: number;
  tools?: ToolSchema[];
  /** Gemini 3.x : budget de « réflexion » (tokens). 0 = désactivé (défaut chat). */
  thinkingBudget?: number;
  signal?: AbortSignal;
};

export type EphemeralToken = {
  token: string;
  expiresAt: string;
  model: string;
};

export type VisionAnalyzeInput = {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  /** JSON Schema attendu en sortie (résultat prudent — §7) */
  responseSchema: Record<string, unknown>;
};

export interface AIProvider {
  readonly name: string;
  isReady(): boolean;

  /** Un aller-retour de génération, en streaming, avec function calling. */
  chat(messages: ChatMessage[], opts?: ChatOptions): AsyncIterable<ChatDelta>;

  /** Analyse d'image → structure prudente (jamais un diagnostic). */
  analyzeImage(input: VisionAnalyzeInput): Promise<Record<string, unknown>>;

  /** Jeton court pour la session voix temps réel (le client se connecte ensuite). */
  createRealtimeToken(scope: "voice"): Promise<EphemeralToken>;
}
