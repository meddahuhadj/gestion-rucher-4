import { create } from "zustand";
import type { ContextSnapshot } from "@moumen/shared";

/**
 * Contexte courant alimentant le Context Engine (§10 / §33).
 * Les pages mettent à jour rucher / ruche / inspection actifs ;
 * MoumenButton l'envoie tel quel à l'API.
 */
type AppContextState = ContextSnapshot & {
  set: (patch: Partial<ContextSnapshot>) => void;
  clearHive: () => void;
};

export const useAppContext = create<AppContextState>((set) => ({
  page: undefined,
  currentApiaryId: null,
  currentHiveId: null,
  currentInspectionId: null,
  set: (patch) => set(patch),
  clearHive: () => set({ currentHiveId: null, currentInspectionId: null }),
}));

export const snapshot = (): ContextSnapshot => {
  const { page, currentApiaryId, currentHiveId, currentInspectionId } =
    useAppContext.getState();
  return { page, currentApiaryId, currentHiveId, currentInspectionId };
};
