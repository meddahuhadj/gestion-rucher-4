import { create } from "zustand";

type NetworkState = {
  online: boolean;
  setOnline: (v: boolean) => void;
};

export const useNetwork = create<NetworkState>((set) => ({
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  setOnline: (online) => set({ online }),
}));

if (typeof window !== "undefined") {
  window.addEventListener("online", () => useNetwork.getState().setOnline(true));
  window.addEventListener("offline", () => useNetwork.getState().setOnline(false));
}
