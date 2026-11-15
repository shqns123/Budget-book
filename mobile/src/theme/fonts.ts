import type { FontFamilyDefinition } from "expo-font";

/**
 * Plus Jakarta Sans, the face the group calendar web app uses: Latin letters and numbers (amounts,
 * dates) are drawn in it, Hangul falls back to the system's Korean font (Noto Sans CJK on Android,
 * Apple SD Gothic Neo on iOS) at the same weight. Loaded at runtime (useFonts) as one family with
 * four weights, so styles pick a face with fontWeight as usual.
 */
export const FONT_FAMILY = "Plus Jakarta Sans";

// Metro needs literal paths in require().
export const APP_FONTS: FontFamilyDefinition[] = [
  {
    fontFamily: FONT_FAMILY,
    fontDefinitions: [
      { path: require("@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf"), weight: 400 },
      { path: require("@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf"), weight: 500 },
      { path: require("@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf"), weight: 600 },
      { path: require("@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf"), weight: 700 },
    ],
  },
];
