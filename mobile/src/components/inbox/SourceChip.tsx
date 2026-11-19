import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Chip,
  FoldMenu,
  PrimaryButton,
  Text,
  useFoldAnchor,
  Wheel,
  type Anchor,
  type WheelItem,
} from "@/components/ui";
import { space } from "@/theme/tokens";

export type SourceOption = { key: string; label: string; count: number };

const ALL = "";

/**
 * The 대기함's 출처 filter: a chip that unfolds a wheel of the cards and accounts the waiting
 * notices came from (전체 first, then most items first), like the 통장 filter on the other tabs.
 */
export function SourceChip({
  options,
  total,
  value,
  onChange,
}: {
  options: SourceOption[];
  total: number;
  value: string;
  onChange: (key: string) => void;
}) {
  const { ref: anchorRef, anchor, open, show, hide, clear } = useFoldAnchor();
  const current = options.find((o) => o.key === value);
  const label = current ? `${current.label} · ${current.count}건` : `전체 · ${total}건`;
  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Chip
          label={label}
          selected={Boolean(current)}
          trailingIcon="chevronDown"
          accessibilityLabel={`출처, ${label}`}
          onPress={show}
        />
      </View>
      {anchor ? (
        <SourceMenu
          anchor={anchor}
          visible={open}
          options={options}
          total={total}
          value={current ? value : ALL}
          onPick={onChange}
          onClose={hide}
          onClosed={clear}
        />
      ) : null}
    </>
  );
}

/** Mounted fresh for each opening; the pick is applied when the panel closes. */
function SourceMenu({
  anchor,
  visible,
  options,
  total,
  value,
  onPick,
  onClose,
  onClosed,
}: {
  anchor: Anchor;
  visible: boolean;
  options: SourceOption[];
  total: number;
  value: string;
  onPick: (key: string) => void;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [pick, setPick] = useState(value);
  const [items] = useState<WheelItem<string>[]>(() => [
    { value: ALL, label: `전체 · ${total}건` },
    ...options.map((o) => ({ value: o.key, label: `${o.label} · ${o.count}건` })),
  ]);
  const close = () => {
    if (pick !== value) onPick(pick);
    onClose();
  };
  return (
    <FoldMenu anchor={anchor} visible={visible} onClose={close} onClosed={onClosed} maxWidth={340} accessibilityLabel="출처 선택">
      <View style={{ gap: space.md }}>
        <View style={styles.head}>
          <Text variant="headline" accessibilityRole="header">
            카드·계좌별로 보기
          </Text>
          <Text variant="footnote" weight="400" color="text2">
            (미연결)은 아직 가계부 통장과 연결하지 않은 카드·계좌예요.
          </Text>
        </View>
        <Wheel items={items} value={value} onChange={setPick} accessibilityLabel="출처" />
        <PrimaryButton label="완료" onPress={close} />
      </View>
    </FoldMenu>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs, paddingHorizontal: space.xs },
});
