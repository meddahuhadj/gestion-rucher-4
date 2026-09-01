import { prisma } from "./db.js";

/** Libellé lisible d'un auteur : displayName > partie locale de l'email > id court. */
function label(u: { id: string; displayName: string | null; email: string }): string {
  if (u.displayName?.trim()) return u.displayName.trim();
  const local = u.email.split("@")[0];
  if (local && !local.includes("unknown") && !local.includes("team")) return local;
  return u.id.slice(0, 8);
}

/**
 * Résout un lot d'ids d'utilisateurs en libellés d'affichage.
 * Sert à attribuer les actions (`createdBy`) dans une équipe co-propriétaire.
 */
export async function resolveAuthors(
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, displayName: true, email: true },
  });
  return new Map(rows.map((u) => [u.id, label(u)]));
}
