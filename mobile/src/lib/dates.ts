const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export const pad = (n: number) => String(n).padStart(2, "0");

export const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const currentMonth = () => todayIso().slice(0, 7);

/** "2026-08" → "2026년 8월" */
export const monthLabel = (month: string) =>
  `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;

/** "26년 11월": the overview title. */
export const shortMonthLabel = (month: string) =>
  `${month.slice(2, 4)}년 ${Number(month.slice(5, 7))}월`;

export const shiftMonth = (month: string, delta: number) => {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

export const lastDayOfMonth = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return `${month}-${pad(new Date(year, m, 0).getDate())}`;
};

export const isoToDate = (iso: string) => {
  const [y, m, d] = iso.replaceAll(".", "-").split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const dateToIso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** "2026.08.13" or "2026-08-13" → "8월 13일 목요일" */
export const spokenDate = (value: string) => {
  const date = isoToDate(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}요일`;
};

/** "2026.08.13" → "8.13 (목)" */
export const shortDate = (value: string) => {
  const date = isoToDate(value);
  return `${date.getMonth() + 1}.${date.getDate()} (${WEEKDAYS[date.getDay()]})`;
};
