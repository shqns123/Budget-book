import { useSyncExternalStore } from "react";

// The add / edit transaction popup. It lives in the tab layout, under the floating tab bar, so the
// bar stays visible (and the + button can close it). Opened from anywhere with openCompose().

export type ComposeRequest = {
  key: number;
  /** Transaction to edit; none adds a new one. */
  id?: string;
  /** Account to start a new record on. */
  account?: string;
  /** "fab": unfolds out of the tab bar's + button; "center": scales up in the middle. */
  from: "fab" | "center";
};

type State = { request: ComposeRequest | null; open: boolean };

let state: State = { request: null, open: false };
let nextKey = 1;
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;

export const useCompose = () => useSyncExternalStore(subscribe, snapshot, snapshot);

export function openCompose(request: Omit<ComposeRequest, "key">) {
  set({ request: { ...request, key: nextKey++ }, open: true });
}

/** Starts the closing animation; the popup calls finishCompose() once it is gone. */
export function closeCompose() {
  if (state.open) set({ ...state, open: false });
}

export function finishCompose(key: number) {
  if (!state.open && state.request?.key === key) set({ request: null, open: false });
}
