import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Icon, IconButton, Row } from "@/components/ui";
import { majorLabel, type AccountSetting } from "@/lib/ledger";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { accountIcon } from "./ScopeControls";

type Drag = { id: string; targetId: string; startY: number; center: number };

export function AccountOrderRows({
  rows,
  onDragChange,
  onDrop,
  onStep,
}: {
  rows: AccountSetting[];
  onDragChange: (active: boolean) => void;
  onDrop: (id: string, targetId: string) => void;
  onStep: (id: string, step: -1 | 1) => void;
}) {
  const { c } = useTheme();
  const centers = useRef(new Map<string, number>());
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ id: string; targetId: string } | null>(null);
  const [offset] = useState(() => new Animated.Value(0));

  useEffect(() => () => {
    if (drag.current) onDragChange(false);
  }, [onDragChange]);

  const start = (id: string, startY: number) => {
    const center = centers.current.get(id);
    if (drag.current || center === undefined || rows.length < 2) return;
    drag.current = { id, targetId: id, startY, center };
    offset.setValue(0);
    setPreview({ id, targetId: id });
    onDragChange(true);
  };

  const move = (id: string, pageY: number) => {
    const active = drag.current;
    if (active?.id !== id) return;
    const first = centers.current.get(rows[0].id) ?? active.center;
    const last = centers.current.get(rows[rows.length - 1].id) ?? active.center;
    const center = Math.max(first, Math.min(last, active.center + pageY - active.startY));
    let closest = id;
    let distance = Infinity;
    rows.forEach((row) => {
      const y = centers.current.get(row.id);
      if (y !== undefined && Math.abs(y - center) < distance) {
        distance = Math.abs(y - center);
        closest = row.id;
      }
    });
    offset.setValue(center - active.center);
    if (closest !== active.targetId) {
      active.targetId = closest;
      setPreview({ id, targetId: closest });
    }
  };

  const finish = (id: string, commit: boolean) => {
    const active = drag.current;
    if (active?.id !== id) return;
    drag.current = null;
    setPreview(null);
    offset.setValue(0);
    onDragChange(false);
    if (commit && active.targetId !== id) onDrop(id, active.targetId);
  };

  return (
    <View>
      {rows.map((account, index) => {
        const lifted = preview?.id === account.id;
        const target = !lifted && preview?.targetId === account.id;
        return (
          <Animated.View
            key={account.id}
            onLayout={({ nativeEvent: { layout } }) =>
              centers.current.set(account.id, layout.y + layout.height / 2)
            }
            onTouchMove={({ nativeEvent }) => move(account.id, nativeEvent.pageY)}
            onTouchEnd={() => finish(account.id, true)}
            onTouchCancel={() => finish(account.id, false)}
            style={[
              target && { backgroundColor: c.subtle },
              lifted && { backgroundColor: c.primaryContainer, zIndex: 1, transform: [{ translateY: offset }] },
            ]}
          >
            <Pressable
              accessible={false}
              delayLongPress={350}
              onLongPress={({ nativeEvent }) => start(account.id, nativeEvent.pageY)}
            >
              <Row
                first={index === 0}
                icon={accountIcon[account.kind] ?? "bank"}
                title={account.name}
                meta={`${majorLabel(account.major)} · ${account.minor}${account.paymentDay ? ` · ${account.paymentDay}일 결제/상환` : ""}`}
                dimmed={account.hidden}
                trailing={
                  <View style={styles.controls}>
                    <Icon name="sort" size={16} color={c.text2} />
                    <IconButton icon="moveUp" label={`${account.name} 위로`} disabled={index === 0} onPress={() => onStep(account.id, -1)} />
                    <IconButton icon="moveDown" label={`${account.name} 아래로`} disabled={index === rows.length - 1} onPress={() => onStep(account.id, 1)} />
                  </View>
                }
              />
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
