import type { ReactElement } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import type { CategorySetting } from "@/lib/ledger";
import { useTheme } from "@/theme/theme";

/**
 * 분류 아이콘: flat colour drawings (32×32) on a pastel tile, one per 대분류. A 대분류 keeps the
 * icon picked in 가계부 설정 (CategorySetting.icon on its rows); without one, its name picks it.
 */
type IconDef = { label: string; hue: number; draw: ReactElement };

export const CATEGORY_ICONS = {
  food: {
    label: "식사",
    hue: 28,
    draw: (
      <>
        <Ellipse cx={11} cy={9} rx={4} ry={5.5} fill="#f08a2c" />
        <Rect x={9.6} y={13} width={2.8} height={15} rx={1.4} fill="#e0701a" />
        <Rect x={18} y={4} width={2} height={9} rx={1} fill="#f08a2c" />
        <Rect x={21.5} y={4} width={2} height={9} rx={1} fill="#f08a2c" />
        <Rect x={25} y={4} width={2} height={9} rx={1} fill="#f08a2c" />
        <Path d="M18 11h9v2.5a4.5 4.5 0 0 1-9 0z" fill="#f08a2c" />
        <Rect x={21.1} y={15} width={2.8} height={13} rx={1.4} fill="#e0701a" />
      </>
    ),
  },
  cafe: {
    label: "카페",
    hue: 30,
    draw: (
      <>
        <Path d="M12 4.5c-1.5 1.5 1.5 3 0 4.5M17 4.5c-1.5 1.5 1.5 3 0 4.5" stroke="#c9a58a" strokeWidth={1.8} strokeLinecap="round" fill="none" />
        <Path d="M22 14h2.2a3 3 0 0 1 0 6H22" stroke="#8a5a3c" strokeWidth={2.4} fill="none" />
        <Path d="M6.5 12h16v6.5a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" fill="#8a5a3c" />
        <Rect x={4.5} y={25.5} width={21} height={2.6} rx={1.3} fill="#c08a64" />
      </>
    ),
  },
  bus: {
    label: "교통",
    hue: 212,
    draw: (
      <>
        <Rect x={5} y={5} width={22} height={20} rx={5} fill="#3d7be0" />
        <Rect x={8} y={8.5} width={7} height={7} rx={1.8} fill="#cfe2ff" />
        <Rect x={17} y={8.5} width={7} height={7} rx={1.8} fill="#cfe2ff" />
        <Rect x={8} y={19} width={3.5} height={2.5} rx={1.2} fill="#ffd34d" />
        <Rect x={20.5} y={19} width={3.5} height={2.5} rx={1.2} fill="#ffd34d" />
        <Rect x={7.5} y={24} width={5} height={4} rx={1.5} fill="#24324a" />
        <Rect x={19.5} y={24} width={5} height={4} rx={1.5} fill="#24324a" />
      </>
    ),
  },
  car: {
    label: "자동차",
    hue: 152,
    draw: (
      <>
        <Path d="M4.5 18.5 7.2 11.6A3 3 0 0 1 10 9.6h12a3 3 0 0 1 2.8 2l2.7 6.9V24a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 24z" fill="#2fa36b" />
        <Path d="m9.2 16.5 1.7-4.4a1 1 0 0 1 .9-.6h8.4a1 1 0 0 1 .9.6l1.7 4.4z" fill="#d6f5e6" />
        <Circle cx={9} cy={20.5} r={1.6} fill="#ffd34d" />
        <Circle cx={23} cy={20.5} r={1.6} fill="#ffd34d" />
        <Rect x={6.5} y={24} width={5} height={4} rx={1.5} fill="#1f3a2d" />
        <Rect x={20.5} y={24} width={5} height={4} rx={1.5} fill="#1f3a2d" />
      </>
    ),
  },
  bag: {
    label: "쇼핑",
    hue: 330,
    draw: (
      <>
        <Path d="M11.5 11V9a4.5 4.5 0 0 1 9 0v2" fill="none" stroke="#c42a6b" strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M6.5 11h19l-1.6 14.2A3 3 0 0 1 20.9 28H11.1a3 3 0 0 1-3-2.8z" fill="#ec4f93" />
        <Path d="M12 17.5a4 4 0 0 0 8 0" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      </>
    ),
  },
  basket: {
    label: "생활용품",
    hue: 40,
    draw: (
      <>
        <Path d="M9 13 13 5.5M23 13 19 5.5" stroke="#b7791f" strokeWidth={2.2} strokeLinecap="round" />
        <Path d="M4 12.5h24l-2.6 13a2.5 2.5 0 0 1-2.4 2H9a2.5 2.5 0 0 1-2.4-2z" fill="#f5a524" />
        <Rect x={11} y={16} width={2.2} height={8} rx={1.1} fill="#fff3d6" />
        <Rect x={15} y={16} width={2.2} height={8} rx={1.1} fill="#fff3d6" />
        <Rect x={19} y={16} width={2.2} height={8} rx={1.1} fill="#fff3d6" />
      </>
    ),
  },
  medical: {
    label: "의료",
    hue: 150,
    draw: (
      <>
        <Rect x={12} y={4.5} width={8} height={23} rx={3} fill="#ef4b4b" />
        <Rect x={4.5} y={12} width={23} height={8} rx={3} fill="#ef4b4b" />
        <Circle cx={16} cy={16} r={2.6} fill="#ffd5d5" />
      </>
    ),
  },
  beauty: {
    label: "미용",
    hue: 335,
    draw: (
      <>
        <Path d="M12 13V7.5L18 4.5V13z" fill="#e8467c" />
        <Rect x={10.5} y={12.5} width={9} height={4} rx={1} fill="#b8325f" />
        <Rect x={9.5} y={16} width={11} height={12} rx={2.5} fill="#f48fb1" />
        <Rect x={12} y={19} width={6} height={1.8} rx={0.9} fill="#fde2ec" />
      </>
    ),
  },
  education: {
    label: "교육",
    hue: 250,
    draw: (
      <>
        <Path d="M9 15v6c0 2.2 3.1 4 7 4s7-1.8 7-4v-6" fill="#a3b3f5" />
        <Path d="m16 6 13 6-13 6-13-6z" fill="#4c45d6" />
        <Path d="M27 12.5v7" stroke="#f5b82e" strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx={27} cy={21} r={1.6} fill="#f5b82e" />
      </>
    ),
  },
  game: {
    label: "여가·취미",
    hue: 270,
    draw: (
      <>
        <Path d="M10 9h12a7 7 0 0 1 6.8 8.7l-1 4A3.6 3.6 0 0 1 21.6 23l-2.4-2.5h-6.4L10.4 23a3.6 3.6 0 0 1-6.2-1.3l-1-4A7 7 0 0 1 10 9z" fill="#7a5be8" />
        <Rect x={8.6} y={13} width={2.4} height={7} rx={1} fill="#fff" />
        <Rect x={6.3} y={15.3} width={7} height={2.4} rx={1} fill="#fff" />
        <Circle cx={21} cy={14.5} r={1.6} fill="#ffd34d" />
        <Circle cx={24} cy={17.5} r={1.6} fill="#6fe0b6" />
      </>
    ),
  },
  travel: {
    label: "여행",
    hue: 190,
    draw: (
      <>
        <Path d="M12.5 9V6.8A1.8 1.8 0 0 1 14.3 5h3.4a1.8 1.8 0 0 1 1.8 1.8V9" fill="none" stroke="#147a8a" strokeWidth={2.2} />
        <Rect x={6} y={9} width={20} height={17} rx={3.5} fill="#22a6b8" />
        <Rect x={10} y={9} width={2.4} height={17} fill="#147a8a" />
        <Rect x={19.6} y={9} width={2.4} height={17} fill="#147a8a" />
        <Rect x={8.5} y={26} width={3} height={2.5} rx={1} fill="#24324a" />
        <Rect x={20.5} y={26} width={3} height={2.5} rx={1} fill="#24324a" />
      </>
    ),
  },
  phone: {
    label: "통신",
    hue: 48,
    draw: (
      <>
        <Rect x={9} y={3.5} width={14} height={25} rx={3.5} fill="#6c63e8" />
        <Rect x={11} y={7} width={10} height={15} rx={1.5} fill="#dcdafc" />
        <Circle cx={16} cy={25} r={1.4} fill="#dcdafc" />
      </>
    ),
  },
  house: {
    label: "주거",
    hue: 22,
    draw: (
      <>
        <Path d="M16 4 3.5 15h3v12.5h19V15h3z" fill="#f5a524" />
        <Path d="M16 4 3.5 15h25z" fill="#f08a1c" />
        <Rect x={13} y={19} width={6} height={8.5} rx={1.5} fill="#9a4f12" />
      </>
    ),
  },
  bill: {
    label: "공과금",
    hue: 45,
    draw: (
      <>
        <Path d="M7 4h18v24l-3-2-3 2-3-2-3 2-3-2-3 2z" fill="#f2b705" />
        <Rect x={10.5} y={9} width={11} height={2.2} rx={1.1} fill="#fff6d0" />
        <Rect x={10.5} y={13.5} width={11} height={2.2} rx={1.1} fill="#fff6d0" />
        <Rect x={10.5} y={18} width={6} height={2.2} rx={1.1} fill="#fff6d0" />
        <Circle cx={22} cy={21} r={3} fill="#a8641a" />
      </>
    ),
  },
  shield: {
    label: "보험",
    hue: 220,
    draw: (
      <>
        <Path d="M16 3.5 26 7v8.5c0 6.3-4.3 10.6-10 13-5.7-2.4-10-6.7-10-13V7z" fill="#2f6fe4" />
        <Path d="m11 16 3.6 3.6L21.5 12" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  gift: {
    label: "경조사",
    hue: 170,
    draw: (
      <>
        <Rect x={5} y={13} width={22} height={15} rx={2.5} fill="#f06aa0" />
        <Rect x={3.5} y={9.5} width={25} height={5} rx={2} fill="#f48fb8" />
        <Rect x={14.5} y={9.5} width={3} height={18.5} fill="#ffd5e6" />
        <Path d="M16 9.5c-2-4-7-5-7-2s4 2 7 2c3 0 7 1 7-2s-5-2-7 2z" fill="#e0336f" />
      </>
    ),
  },
  bank: {
    label: "세금",
    hue: 205,
    draw: (
      <>
        <Path d="M16 3.5 3.5 10v2.5h25V10z" fill="#5d7287" />
        <Rect x={6.5} y={14} width={3} height={10} rx={1} fill="#8aa0b5" />
        <Rect x={12.2} y={14} width={3} height={10} rx={1} fill="#8aa0b5" />
        <Rect x={16.9} y={14} width={3} height={10} rx={1} fill="#8aa0b5" />
        <Rect x={22.5} y={14} width={3} height={10} rx={1} fill="#8aa0b5" />
        <Rect x={4} y={25} width={24} height={3} rx={1.2} fill="#44566a" />
      </>
    ),
  },
  piggy: {
    label: "저축",
    hue: 350,
    draw: (
      <>
        <Ellipse cx={15} cy={17.5} rx={10.5} ry={8} fill="#f2566e" />
        <Path d="M9 11.5 8 6.5l5 3.5z" fill="#f2566e" />
        <Rect x={24} y={14.5} width={4.5} height={6} rx={2} fill="#f2566e" />
        <Circle cx={20} cy={15} r={1.3} fill="#3b1820" />
        <Rect x={12} y={8.6} width={6} height={2} rx={1} fill="#ffd34d" />
        <Rect x={9} y={23} width={3.5} height={5} rx={1.5} fill="#d83c55" />
        <Rect x={17.5} y={23} width={3.5} height={5} rx={1.5} fill="#d83c55" />
      </>
    ),
  },
  card: {
    label: "카드",
    hue: 355,
    draw: (
      <>
        <Rect x={3.5} y={7} width={25} height={18} rx={3.5} fill="#e8475e" />
        <Rect x={3.5} y={11} width={25} height={3.5} fill="#a92a3d" />
        <Rect x={7} y={18} width={6} height={3.5} rx={1} fill="#ffd8a8" />
        <Rect x={18} y={19} width={7} height={1.8} rx={0.9} fill="#ffc2cb" />
      </>
    ),
  },
  salary: {
    label: "월급",
    hue: 140,
    draw: (
      <>
        <Rect x={3} y={8} width={26} height={16} rx={3} fill="#33a96b" />
        <Rect x={5.5} y={10.5} width={21} height={11} rx={2} fill="none" stroke="#bff0d5" strokeWidth={1.4} />
        <Circle cx={16} cy={16} r={3.6} fill="#bff0d5" />
        <Path d="M16 13.8v4.4" stroke="#33a96b" strokeWidth={1.6} strokeLinecap="round" />
      </>
    ),
  },
  coins: {
    label: "용돈·이자",
    hue: 46,
    draw: (
      <>
        <Ellipse cx={13} cy={24} rx={8.5} ry={3.5} fill="#d99a06" />
        <Rect x={4.5} y={18.5} width={17} height={5.5} fill="#d99a06" />
        <Ellipse cx={13} cy={18.5} rx={8.5} ry={3.5} fill="#ffc933" />
        <Ellipse cx={20} cy={13} rx={8} ry={3.3} fill="#d99a06" />
        <Rect x={12} y={8} width={16} height={5} fill="#d99a06" />
        <Ellipse cx={20} cy={8} rx={8} ry={3.3} fill="#ffd95e" />
      </>
    ),
  },
  chart: {
    label: "투자",
    hue: 160,
    draw: (
      <>
        <Rect x={5} y={18} width={5} height={9} rx={1.5} fill="#7fd6b0" />
        <Rect x={13.5} y={13} width={5} height={14} rx={1.5} fill="#3fbf89" />
        <Rect x={22} y={8} width={5} height={19} rx={1.5} fill="#16935f" />
        <Path d="M5 13 12 7l5 3 8-6" fill="none" stroke="#ef4b4b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  paw: {
    label: "반려동물",
    hue: 25,
    draw: (
      <>
        <Ellipse cx={16} cy={21} rx={7} ry={6} fill="#a8683c" />
        <Ellipse cx={7.5} cy={14} rx={2.8} ry={3.4} fill="#c48352" />
        <Ellipse cx={12.5} cy={8.5} rx={2.8} ry={3.4} fill="#c48352" />
        <Ellipse cx={19.5} cy={8.5} rx={2.8} ry={3.4} fill="#c48352" />
        <Ellipse cx={24.5} cy={14} rx={2.8} ry={3.4} fill="#c48352" />
      </>
    ),
  },
  play: {
    label: "구독",
    hue: 0,
    draw: (
      <>
        <Rect x={3.5} y={7} width={25} height={18} rx={5} fill="#e53935" />
        <Path d="M13.5 11.5v9l8-4.5z" fill="#fff" />
      </>
    ),
  },
  etc: {
    label: "기타",
    hue: 215,
    draw: (
      <>
        <Circle cx={8} cy={16} r={3} fill="#8c96a5" />
        <Circle cx={16} cy={16} r={3} fill="#5f6b7b" />
        <Circle cx={24} cy={16} r={3} fill="#8c96a5" />
      </>
    ),
  },
} satisfies Record<string, IconDef>;

export type CategoryIconKey = keyof typeof CATEGORY_ICONS;
export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS) as CategoryIconKey[];

const isIconKey = (value: unknown): value is CategoryIconKey =>
  typeof value === "string" && value in CATEGORY_ICONS;

/** Words in a 대분류 / 소분류 name and the icon they mean; the first match wins. */
const BY_NAME: [RegExp, CategoryIconKey][] = [
  [/카드/, "card"],
  [/카페|커피|간식|디저트|베이커리/, "cafe"],
  [/식비|식사|외식|음식|배달|식료|밥|식당/, "food"],
  [/주유|주차|자동차|차량|통행|정비/, "car"],
  [/교통|버스|지하철|택시|대중교통/, "bus"],
  [/의료|병원|약|건강|치과/, "medical"],
  [/미용|화장|헤어|뷰티|네일/, "beauty"],
  [/교육|학원|도서|책|강의|학비/, "education"],
  [/여행|숙박|항공|호텔/, "travel"],
  [/여가|취미|문화|게임|영화|공연|운동/, "game"],
  [/구독|ott|넷플릭스|유튜브|멤버십/, "play"],
  [/통신|휴대폰|핸드폰|인터넷|전화/, "phone"],
  [/공과금|관리비|전기|가스|수도/, "bill"],
  [/주거|월세|전세|주택|집/, "house"],
  [/보험/, "shield"],
  [/경조사|선물|축의|부의|기부/, "gift"],
  [/세금|국세|지방세|과태료/, "bank"],
  [/투자|주식|펀드|코인/, "chart"],
  [/저축|적금|예금|저금/, "piggy"],
  [/반려|애완|펫|동물/, "paw"],
  [/생활|마트|생필품|용품|잡화/, "basket"],
  [/쇼핑|의류|패션|온라인|옷/, "bag"],
  [/월급|급여|상여|보너스|수입/, "salary"],
  [/용돈|이자|환급|부수입|캐시백|포인트/, "coins"],
];

/** The icon a name suggests, for a 대분류 no one picked one for. */
export function iconForName(name: string): CategoryIconKey {
  const text = name.toLowerCase();
  return BY_NAME.find(([words]) => words.test(text))?.[1] ?? "etc";
}

/** A 대분류's icon: the one picked in 가계부 설정 (on any of its rows), else by its name. */
export function categoryIcon(
  categories: CategorySetting[],
  type: "income" | "expense",
  major: string,
): CategoryIconKey {
  const picked = categories.find((c) => c.transactionType === type && c.major === major && isIconKey(c.icon))?.icon;
  return isIconKey(picked) ? picked : iconForName(major);
}

/** The pastel tile with the drawing: 36px in lists, by default. */
export function CategoryTile({ icon, size = 36 }: { icon: CategoryIconKey; size?: number }) {
  const { dark } = useTheme();
  const def: IconDef = CATEGORY_ICONS[icon];
  const background = dark ? `hsl(${def.hue}, 28%, 24%)` : `hsl(${def.hue}, 85%, 94%)`;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size * 0.64} height={size * 0.64} viewBox="0 0 32 32">
        {def.draw}
      </Svg>
    </View>
  );
}
