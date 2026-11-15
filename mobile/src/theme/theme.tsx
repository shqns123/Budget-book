import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Platform, useColorScheme, type ViewStyle } from "react-native";
import { colors, type ColorTokens } from "./tokens";

type Theme = {
  c: ColorTokens;
  dark: boolean;
  /** Only floating things lift: tab bar, action bar, sheets. */
  shadow: (kind: "tabbar" | "float" | "dialog") => ViewStyle;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const value = useMemo<Theme>(() => {
    const c = dark ? colors.dark : colors.light;
    return {
      c,
      dark,
      shadow: (kind) => {
        if (dark && kind === "tabbar") {
          return { borderWidth: 1, borderColor: c.outline };
        }
        const spec = {
          tabbar: { y: 6, blur: 18, alpha: 0.14, elevation: 8 },
          float: { y: 6, blur: 16, alpha: dark ? 0.5 : 0.14, elevation: 8 },
          dialog: { y: 10, blur: 24, alpha: dark ? 0.5 : 0.18, elevation: 16 },
        }[kind];
        return Platform.select<ViewStyle>({
          android: { elevation: spec.elevation, shadowColor: "#0f172a" },
          default: {
            shadowColor: "#0f172a",
            shadowOffset: { width: 0, height: spec.y },
            shadowRadius: spec.blur / 2,
            shadowOpacity: spec.alpha,
          },
        })!;
      },
    };
  }, [dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside ThemeProvider");
  return theme;
}
