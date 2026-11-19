import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform } from "react-native";

/**
 * Icons are called by meaning, never by set name.
 * iOS draws Ionicons, Android draws Material Icons.
 */
const ios = {
  overview: "home-outline",
  list: "list-outline",
  chart: "bar-chart-outline",
  more: "grid-outline",
  plus: "add",
  chevronRight: "chevron-forward",
  chevronLeft: "chevron-back",
  chevronDown: "chevron-down",
  moveUp: "chevron-up",
  moveDown: "chevron-down",
  close: "close",
  search: "search",
  filter: "filter",
  sort: "swap-vertical",
  edit: "create-outline",
  refresh: "refresh",
  trash: "trash-outline",
  image: "images-outline",
  repeat: "repeat",
  income: "arrow-up",
  expense: "arrow-down",
  transfer: "swap-horizontal",
  bank: "business-outline",
  card: "card-outline",
  loan: "document-text-outline",
  piggy: "wallet-outline",
  wallet: "cash-outline",
  settings: "options-outline",
  logout: "log-out-outline",
  check: "checkmark",
  checkbox: "checkbox",
  checkboxEmpty: "square-outline",
  eyeOff: "eye-off-outline",
  eye: "eye-outline",
  calendar: "calendar-outline",
  server: "server-outline",
  alert: "alert-circle-outline",
  sparkles: "sparkles-outline",
  balance: "pie-chart-outline",
  members: "people-outline",
  mail: "mail-outline",
  inbox: "file-tray-outline",
  link: "link-outline",
} as const;

export type IconName = keyof typeof ios;

const android: Record<IconName, keyof typeof MaterialIcons.glyphMap> = {
  overview: "home",
  list: "receipt-long",
  chart: "bar-chart",
  more: "apps",
  plus: "add",
  chevronRight: "chevron-right",
  chevronLeft: "chevron-left",
  chevronDown: "expand-more",
  moveUp: "keyboard-arrow-up",
  moveDown: "keyboard-arrow-down",
  close: "close",
  search: "search",
  filter: "filter-list",
  sort: "swap-vert",
  edit: "edit",
  refresh: "refresh",
  trash: "delete-outline",
  image: "add-photo-alternate",
  repeat: "repeat",
  income: "arrow-upward",
  expense: "arrow-downward",
  transfer: "swap-horiz",
  bank: "account-balance",
  card: "credit-card",
  loan: "request-quote",
  piggy: "savings",
  wallet: "account-balance-wallet",
  settings: "tune",
  logout: "logout",
  check: "check",
  checkbox: "check-box",
  checkboxEmpty: "check-box-outline-blank",
  eyeOff: "visibility-off",
  eye: "visibility",
  calendar: "calendar-today",
  server: "dns",
  alert: "error-outline",
  sparkles: "auto-awesome",
  balance: "pie-chart-outline",
  members: "group",
  mail: "mail-outline",
  inbox: "inbox",
  link: "link",
};

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
}) {
  if (Platform.OS === "ios") {
    return <Ionicons name={ios[name]} size={size} color={color} />;
  }
  return <MaterialIcons name={android[name]} size={size} color={color} />;
}

/** Line icons for the floating tab bar (22px). */
export const tabIcons = {
  overview: "home",
  list: "list",
  chart: "bar-chart-2",
  balance: "pie-chart",
  more: "grid",
  plus: "plus",
} as const satisfies Record<string, keyof typeof Feather.glyphMap>;

export function TabIcon({
  name,
  size = 22,
  color,
}: {
  name: keyof typeof tabIcons;
  size?: number;
  color: string;
}) {
  return <Feather name={tabIcons[name]} size={size} color={color} />;
}
