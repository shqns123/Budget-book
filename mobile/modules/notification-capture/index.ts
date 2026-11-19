import { requireOptionalNativeModule, type EventSubscription, type NativeModule } from "expo";
import { Platform } from "react-native";

/** A payment notification captured on the phone, waiting to be read into the 대기함. */
export type CapturedNotice = {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  /** Epoch milliseconds. */
  postedAt: number;
};

export type SeenApp = { packageName: string; appName: string; lastSeen: number };

type Events = { onNotice: (event: Record<string, never>) => void };

declare class NotificationCaptureModule extends NativeModule<Events> {
  hasAccess(): boolean;
  openAccessSettings(): boolean;
  getPending(): CapturedNotice[];
  removePending(ids: string[]): void;
  getAllowedPackages(): string[];
  setAllowedPackages(packages: string[]): void;
  getDefaultPackages(): string[];
  getSeenApps(): SeenApp[];
}

// Android only, and only in a build that has the module (not Expo Go): elsewhere every call is a
// harmless no-op, so screens can use it without checking.
const native =
  Platform.OS === "android" ? requireOptionalNativeModule<NotificationCaptureModule>("NotificationCapture") : null;

export const isSupported = Boolean(native);

export const hasAccess = () => native?.hasAccess() ?? false;
export const openAccessSettings = () => native?.openAccessSettings() ?? false;
export const getPending = (): CapturedNotice[] => native?.getPending() ?? [];
export const removePending = (ids: string[]) => {
  if (ids.length) native?.removePending(ids);
};
export const getAllowedPackages = () => native?.getAllowedPackages() ?? [];
export const setAllowedPackages = (packages: string[]) => native?.setAllowedPackages(packages);
export const getDefaultPackages = () => native?.getDefaultPackages() ?? [];
export const getSeenApps = (): SeenApp[] => native?.getSeenApps() ?? [];

/** Called whenever a new notice was captured while the app is running. */
export function addNoticeListener(listener: () => void): EventSubscription | null {
  return native?.addListener("onNotice", listener) ?? null;
}
