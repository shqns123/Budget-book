/**
 * 잔잔한 가계부 — native theme.
 *
 * Structure, scales and component rules come from the shared mobile design
 * system ("조용한 화면": gray canvas, white sections, colour only for
 * selection, action and state). Brand colours come from the web app:
 * ink #17191c leads every action, peach #fbe1d1 with sienna #5d2a1a marks
 * selection and the rare accent card.
 *
 * Never hard-code a hex in a screen. Read colours from `useTheme().c`.
 */

export const palette = {
  ink: "#17191c",
  paper: "#ffffff",
  mist: "#f2f2f3",
  slate: "#777b86",
  peach: "#fbe1d1",
  sienna: "#5d2a1a",
  apricot: "#f4b894",
} as const;

const light = {
  // Neutrals (design system)
  bg: "#f5f6f8",
  surface: "#ffffff",
  sheet: "#f5f6f8",
  card: "#ffffff",
  outline: "#e8ebef",
  subtle: "#f0f2f5",
  strong: "#8b95a1",
  handle: "#b0b8c1",
  text: "#191f28",
  text2: "#5f6b79",
  muted: "#5f6b79",
  tertiary: "#8b95a1",
  fill: "#e8ebef",
  segmentTrack: "#f0f2f5",
  segmentSelected: "#ffffff",
  switchOff: "#8b95a1",
  scrim: "rgba(25,31,40,0.42)",
  shadow: "#191f28",

  // Brand (web app): ink action, peach selection
  primary: palette.ink,
  onPrimary: "#ffffff",
  primaryText: palette.ink,
  primaryContainer: palette.peach,
  onPrimaryContainer: palette.sienna,

  // Ledger state (web app .up / .down)
  income: "#36705f",
  expense: "#a85135",
  incomeContainer: "#e3f0ea",
  expenseContainer: "#f9e8df",
  transferContainer: "#f0f2f5",
  chartIncome: palette.ink,
  chartExpense: palette.apricot,

  // Feedback
  danger: "#c92a2a",
  onDanger: "#ffffff",
  dangerContainer: "#fdecec",
  warnContainer: "#fff8e6",
  onWarn: "#8a4b08",
  okContainer: "#eaf8f1",
  onOk: "#0b6b48",
};

export type ColorTokens = Record<keyof typeof light, string>;

const dark: ColorTokens = {
  bg: "#101318",
  surface: "#1b2028",
  sheet: "#101318",
  card: "#1b2028",
  outline: "#343c48",
  subtle: "#252b35",
  strong: "#98a3b1",
  handle: "#5c6675",
  text: "#f4f6f8",
  text2: "#b2bbc7",
  muted: "#b2bbc7",
  tertiary: "#98a3b1",
  fill: "#343c48",
  segmentTrack: "#252b35",
  segmentSelected: "#343c48",
  switchOff: "#5c6675",
  scrim: "rgba(0,0,0,0.6)",
  shadow: "#000000",

  // The Night Room Rule: ink turns to paper, text on it turns dark.
  primary: "#f4f6f8",
  onPrimary: palette.ink,
  primaryText: "#f4f6f8",
  primaryContainer: "#43302a",
  onPrimaryContainer: palette.peach,

  income: "#7fd1b4",
  expense: "#f2a98c",
  incomeContainer: "#15302a",
  expenseContainer: "#3a2620",
  transferContainer: "#252b35",
  chartIncome: "#f4f6f8",
  chartExpense: palette.apricot,

  danger: "#ff8585",
  onDanger: "#101318",
  dangerContainer: "#3a1f22",
  warnContainer: "#2e2614",
  onWarn: "#fcd34d",
  okContainer: "#15302a",
  onOk: "#6ee7b7",
};

export const colors = { light, dark };

/** 4 · 8 · 12 · 16 · 24 · 32, plus the 20px row inset. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  rowX: 20,
} as const;

/** Corners mean roles. */
export const radius = {
  chip: 6,
  tile: 12,
  control: 14,
  card: 20,
  popover: 24,
  sheet: 28,
  pill: 999,
} as const;

export const size = {
  hit: 48,
  primary: 56,
  control: 52,
  tabbar: 62,
  row: 60,
  fab: 46,
  tile: 36,
} as const;

export const opacity = {
  pressed: 0.85,
  tabPressed: 0.6,
  disabled: 0.4,
} as const;

/** One system family; hierarchy from weight. 12px is the floor. */
export const type = {
  title1: { fontSize: 30, lineHeight: 36, fontWeight: "700", letterSpacing: -0.5 },
  title2: { fontSize: 22, lineHeight: 29, fontWeight: "700", letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 24, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  subhead: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  tabLabel: { fontSize: 11, lineHeight: 14, fontWeight: "500" },
} as const;

export type TypeRole = keyof typeof type;

export const motion = {
  spring: { stiffness: 420, damping: 34, mass: 1 },
  open: 220,
  close: 180,
  swap: 120,
} as const;
