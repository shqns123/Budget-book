import { Alert } from "react-native";

// Confirm / notice popups. With <DialogHost/> mounted (root layout) they show as the app's own
// popup card; before it mounts they fall back to the OS alert.

export type DialogRequest = {
  kind: "confirm" | "notice";
  title: string;
  message?: string;
  confirmLabel: string;
  destructive: boolean;
  resolve: (ok: boolean) => void;
};

let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();
let hosts = 0;

export function subscribeDialog(listener: () => void) {
  listeners.add(listener);
  hosts += 1;
  return () => {
    listeners.delete(listener);
    hosts -= 1;
  };
}

export const currentDialog = (): DialogRequest | null => queue[0] ?? null;

export function closeDialog(request: DialogRequest, ok: boolean) {
  queue = queue.filter((r) => r !== request);
  listeners.forEach((l) => l());
  request.resolve(ok);
}

function open(request: Omit<DialogRequest, "resolve">) {
  return new Promise<boolean>((resolve) => {
    queue = [...queue, { ...request, resolve }];
    listeners.forEach((l) => l());
  });
}

/** Confirm popup; resolves true when the user confirms. */
export function confirm({
  title,
  message,
  confirmLabel = "확인",
  destructive = false,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  if (hosts > 0) return open({ kind: "confirm", title, message, confirmLabel, destructive });
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "취소", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ]);
  });
}

/** One-button message popup. */
export function notice(title: string, message?: string) {
  if (hosts > 0) {
    void open({ kind: "notice", title, message, confirmLabel: "확인", destructive: false });
    return;
  }
  Alert.alert(title, message);
}
