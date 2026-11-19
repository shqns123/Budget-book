const TURN = Math.PI * 2;

type Seam = { angle: number; depth: number; overlap: number };

/** Build a continuous ring with round seams that curve back into the previous slice. */
export function donutGeometry(
  amounts: number[],
  center: number,
  inner: number,
  outer: number,
) {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const radius = (outer + inner) / 2;
  const half = (outer - inner) / 2;
  const segments: ({ path: string; angle: number } | null)[] = amounts.map(() => null);
  let angle = 0;
  const slices = amounts.flatMap((amount, index) => {
    if (amount <= 0) return [];
    const span = (amount / total) * TURN;
    const start = angle;
    angle += span;
    return [{ index, start, span }];
  });

  const point = (r: number, a: number) =>
    `${center + r * Math.sin(a)} ${center - r * Math.cos(a)}`;
  const circleArc = (r: number, from: number, to: number) =>
    `A ${r} ${r} 0 ${Number(Math.abs(to - from) > Math.PI)} ${Number(to > from)} ${point(r, to)}`;

  if (slices.length === 1) {
    segments[slices[0].index] = {
      angle: Math.PI,
      path: [
        `M ${point(outer, 0)}`,
        circleArc(outer, 0, Math.PI),
        circleArc(outer, Math.PI, TURN),
        "Z",
        `M ${point(inner, 0)}`,
        circleArc(inner, 0, -Math.PI),
        circleArc(inner, -Math.PI, -TURN),
        "Z",
      ].join(" "),
    };
  }

  const seams: Seam[] = slices.map(({ start, span }, index) => {
    const previous = slices[(index + slices.length - 1) % slices.length];
    const room = Math.min(previous.span, span);
    return {
      angle: start,
      depth: Math.min(half, radius * room * 0.44),
      overlap: Math.min(0.75 / radius, room * 0.15),
    };
  });

  if (slices.length > 1) {
    const seamArc = (a: number, depth: number, inward: boolean) =>
      `A ${half} ${depth} ${(a * 180) / Math.PI - 90} 0 ${inward ? 0 : 1} ${point(inward ? inner : outer, a)}`;

    slices.forEach(({ index, start, span }, sliceIndex) => {
      const left = seams[sliceIndex];
      const right = seams[(sliceIndex + 1) % seams.length];
      const end = start + span + right.overlap;
      segments[index] = {
        angle: start + span / 2,
        path: [
          `M ${point(outer, start)}`,
          circleArc(outer, start, end),
          seamArc(end, right.depth, true),
          circleArc(inner, end, start),
          seamArc(start, left.depth, false),
          "Z",
        ].join(" "),
      };
    });
  }

  const seamAngle = (seam: Seam, distance: number) => {
    const d = Math.min(outer, Math.max(inner, distance));
    const depth = seam.depth;
    const a = half * half - depth * depth;
    const b = 2 * radius * half;
    const c = d * d - radius * radius - depth * depth;
    const cos = Math.max(
      -1,
      Math.min(1, (2 * c) / (b + Math.sqrt(b * b + 4 * a * c))),
    );
    return seam.angle - Math.atan2(depth * Math.sqrt(1 - cos * cos), radius + half * cos);
  };

  const indexAt = (dx: number, dy: number) => {
    const distance = Math.hypot(dx, dy);
    if (distance < inner - 8 || distance > outer + 8) return -1;
    if (slices.length < 2) return slices[0]?.index ?? -1;

    let pointerAngle = (Math.atan2(dx, -dy) + TURN) % TURN;
    if (pointerAngle >= seamAngle(seams[0], distance) + TURN) pointerAngle -= TURN;
    const next = seams.findIndex(
      (seam, index) => index > 0 && pointerAngle < seamAngle(seam, distance),
    );
    return slices[next < 0 ? slices.length - 1 : next - 1].index;
  };

  return { segments, indexAt };
}
