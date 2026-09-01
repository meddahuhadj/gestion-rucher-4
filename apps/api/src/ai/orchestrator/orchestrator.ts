import type { ChatRequest, ChatDelta as WireDelta, Locale } from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { writeAudit } from "../../core/audit.js";
import { aiProvider } from "../provider/index.js";
import type { ChatMessage, ToolCall } from "../provider/AIProvider.js";
import { buildContext, contextToPrompt } from "../context/contextEngine.js";
import { systemPrompt } from "./systemPrompt.js";
import { proposeAction } from "./pendingActions.js";
import { toolByName, toolSchemas } from "../tools/registry.js";

const MAX_ITERATIONS = 4;

type Emit = (delta: WireDelta) => void;

/**
 * Boucle de l'orchestrateur — §8.
 * intent (implicite via le modèle) → context → plan → tools → validation →
 * confirmation (niveau 2/3) → réponse. Bornée à MAX_ITERATIONS.
 */
export async function runChat(
  ctx: AuthUser,
  req: ChatRequest,
  emit: Emit,
  signal?: AbortSignal,
): Promise<void> {
  const provider = aiProvider();
  if (!provider.isReady()) {
    emit({ type: "error", code: "ai_unavailable", message: "Fournisseur IA non configuré." });
    return;
  }

  const locale: Locale = req.locale ?? "fr";
  const built = await buildContext(ctx, req.context);

  // session de conversation
  const session = req.sessionId
    ? await prisma.conversationSession.findFirst({
        where: { id: req.sessionId, ownerId: ctx.dataOwnerId },
      })
    : null;
  const sessionId =
    session?.id ??
    (
      await prisma.conversationSession.create({
        data: {
          ownerId: ctx.dataOwnerId,
          channel: req.channel,
          locale,
          page: built.page,
          contextSnapshot: JSON.parse(JSON.stringify(req.context ?? {})),
        },
      })
    ).id;

  // historique récent (10 derniers messages)
  const history = await prisma.conversationMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(locale, contextToPrompt(built)) },
    ...history.map<ChatMessage>((m) => ({
      role: m.role === "assistant" ? "assistant" : m.role === "tool" ? "tool" : "user",
      content: m.content ?? "",
      toolName: m.toolName ?? undefined,
    })),
    { role: "user", content: req.message },
  ];

  await prisma.conversationMessage.create({
    data: { sessionId, role: "user", content: req.message },
  });

  let assistantText = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let proposed = false;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const toolCalls: ToolCall[] = [];
    let turnText = "";

    for await (const d of provider.chat(messages, {
      tools: toolSchemas(),
      temperature: 0.3,
      signal,
    })) {
      if (d.type === "text") {
        turnText += d.value;
        assistantText += d.value;
        emit({ type: "text", value: d.value });
      } else if (d.type === "tool_call") {
        toolCalls.push({
          id: d.id,
          name: d.name,
          args: d.args,
          thoughtSignature: d.thoughtSignature,
        });
        emit({ type: "tool_call", tool: d.name, args: d.args });
      } else if (d.type === "usage") {
        tokensIn += d.tokensIn;
        tokensOut += d.tokensOut;
      }
    }

    if (toolCalls.length === 0) break;

    // enregistre le tour assistant (avec ses appels d'outils)
    messages.push({ role: "assistant", content: turnText, toolCalls });

    let mustStop = false;
    for (const call of toolCalls) {
      const tool = toolByName.get(call.name);
      if (!tool) {
        messages.push({
          role: "tool",
          toolName: call.name,
          content: JSON.stringify({ error: "outil inconnu" }),
        });
        emit({ type: "tool_result", tool: call.name, ok: false });
        continue;
      }

      // validation des paramètres (§9)
      let args: unknown;
      try {
        args = tool.validate(call.args);
      } catch (err) {
        messages.push({
          role: "tool",
          toolName: call.name,
          content: JSON.stringify({ error: "paramètres invalides", details: String(err) }),
        });
        emit({ type: "tool_result", tool: call.name, ok: false });
        continue;
      }

      // niveau 1 : exécution directe
      if (tool.level === 1) {
        try {
          const result = await tool.run(args, ctx);
          messages.push({
            role: "tool",
            toolName: call.name,
            content: JSON.stringify({ ok: true, data: result }),
          });
          emit({ type: "tool_result", tool: call.name, ok: true });
        } catch (err) {
          messages.push({
            role: "tool",
            toolName: call.name,
            content: JSON.stringify({ ok: false, error: String(err) }),
          });
          emit({ type: "tool_result", tool: call.name, ok: false });
        }
        continue;
      }

      // niveau 2 / 3 : NE PAS exécuter — proposer une action à confirmer (§23)
      const summary = tool.summarize(args as Record<string, unknown>);
      const { token, expiresAt } = proposeAction({
        userId: ctx.id,
        tool: tool.name,
        level: tool.level,
        args: args as Record<string, unknown>,
        summary,
      });
      emit({
        type: "action_proposal",
        proposal: {
          actionToken: token,
          tool: tool.name,
          level: tool.level,
          summary,
          args: args as Record<string, unknown>,
          expiresAt,
        },
      });
      messages.push({
        role: "tool",
        toolName: call.name,
        content: JSON.stringify({
          ok: false,
          pending_confirmation: true,
          note: "Action proposée à l'utilisateur, en attente de confirmation.",
        }),
      });
      proposed = true;
      mustStop = true;
    }

    if (mustStop) break;
  }

  // persistance du tour assistant + usage
  await prisma.conversationMessage.create({
    data: {
      sessionId,
      role: "assistant",
      content: assistantText || (proposed ? "(action proposée)" : ""),
      tokensIn: tokensIn || null,
      tokensOut: tokensOut || null,
    },
  });
  await writeAudit({
    actorId: ctx.id,
    action: "ai.chat",
    entity: "conversation_session",
    entityId: sessionId,
    via: "ai",
    after: { tokensIn, tokensOut, proposed },
  });

  emit({ type: "done", sessionId });
}
