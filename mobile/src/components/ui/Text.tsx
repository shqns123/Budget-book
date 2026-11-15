import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { type, type ColorTokens, type TypeRole } from "@/theme/tokens";

type Props = TextProps & {
  variant?: TypeRole;
  color?: keyof ColorTokens;
  weight?: TextStyle["fontWeight"];
  align?: TextStyle["textAlign"];
  tabular?: boolean;
};

export function Text({
  variant = "body",
  color = "text",
  weight,
  align,
  tabular,
  style,
  ...props
}: Props) {
  const { c } = useTheme();
  return (
    <RNText
      {...props}
      style={[
        type[variant],
        { color: c[color] },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ["tabular-nums"] } : null,
        style,
      ]}
    />
  );
}
