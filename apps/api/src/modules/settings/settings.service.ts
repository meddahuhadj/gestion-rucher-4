import {
  DEFAULT_THRESHOLDS,
  DEFAULT_UNITS,
  zSettings,
  zThresholds,
  zUnits,
  type Settings,
  type SettingsUpdate,
  type Thresholds,
} from "@moumen/shared";
import type { AuthUser } from "../../core/auth.js";
import { prisma } from "../../core/db.js";
import { writeAudit } from "../../core/audit.js";

type SettingsBlob = { thresholds?: Partial<Thresholds> } & Record<string, unknown>;

/** Fusionne le blob `users.settings` sur les seuils par défaut. */
export function resolveThresholds(settings: unknown): Thresholds {
  const raw = (settings as SettingsBlob | null)?.thresholds ?? {};
  return zThresholds.parse({ ...DEFAULT_THRESHOLDS, ...raw });
}

async function getSettings(ctx: AuthUser): Promise<Settings> {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.id },
    select: { displayName: true, locale: true, currency: true, units: true, settings: true },
  });
  return zSettings.parse({
    displayName: u.displayName,
    locale: u.locale,
    currency: u.currency,
    units: zUnits.parse({ ...DEFAULT_UNITS, ...((u.units as object) ?? {}) }),
    thresholds: resolveThresholds(u.settings),
  });
}

export const settingsService = {
  get: getSettings,

  async update(ctx: AuthUser, input: SettingsUpdate): Promise<Settings> {
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: ctx.id },
      select: { units: true, settings: true },
    });

    const nextUnits = input.units
      ? zUnits.parse({ ...DEFAULT_UNITS, ...((u.units as object) ?? {}), ...input.units })
      : undefined;

    const nextSettings = input.thresholds
      ? {
          ...((u.settings as SettingsBlob | null) ?? {}),
          thresholds: {
            ...resolveThresholds(u.settings),
            ...input.thresholds,
          },
        }
      : undefined;

    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: ctx.id },
        data: {
          displayName: input.displayName === undefined ? undefined : input.displayName,
          locale: input.locale ?? undefined,
          currency: input.currency ?? undefined,
          units: nextUnits ?? undefined,
          settings: nextSettings ?? undefined,
        },
      });
      await writeAudit(
        {
          actorId: ctx.id,
          action: "settings.update",
          entity: "user",
          entityId: ctx.id,
          after: {
            displayName: updated.displayName,
            locale: updated.locale,
            currency: updated.currency,
            units: updated.units,
            settings: updated.settings,
          },
          via: "ui",
        },
        tx,
      );
    });

    return getSettings(ctx);
  },
};
