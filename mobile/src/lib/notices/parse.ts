/**
 * Reading a payment notification (card approval, bank withdrawal / deposit) into its fields.
 * Pure functions with no app imports: the rules here are checked against real notices.
 *
 * Sources with a known layout (KB Pay, 카카오뱅크) have their own template; any other text goes
 * through the generic reader, which takes the fields it knows out of the text and keeps what is
 * left as the 가맹점. When neither reads it, the server's model is asked (lib/notices/analyze).
 */

export type NoticeDirection = "out" | "in" | "cancel";

export type NoticeSource = {
  /** Stable id of the card or account the notice is about: "KB국민카드|2222". */
  key: string;
  /** What the 대기함 shows before it is linked to a ledger account: "KB국민카드 2222". */
  label: string;
  kind: "card" | "account";
};

export type ParsedNotice = {
  direction: NoticeDirection;
  /** Won; 0 when the notice gave only a foreign amount. */
  amount: number;
  /** "KRW", or the foreign currency's code. */
  currency: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm, or "" */
  time: string;
  /** 가맹점, the person paid, or the memo the sender wrote. */
  counterparty: string;
  source: NoticeSource;
  /** Months of 할부; 0 = 일시불 or not a card. */
  installment: number;
  via: "template" | "generic" | "model";
};

export type RawNotice = {
  packageName: string;
  appName: string;
  title: string;
  text: string;
  /** Epoch milliseconds */
  postedAt: number;
};

const MONEY = /\d[\d,]*\s*원/;
const TX_WORD = /승인|결제|사용|취소|출금|입금|이체/;
const REJECT = /인증\s*번호|OTP|비밀번호|[(\[]광고[)\]]|결제\s*예정|청구\s*금액|명세서/;

/** The same check the phone makes before keeping a notice (NoticeStore.kt). */
export const looksLikePayment = (text: string) => MONEY.test(text) && TX_WORD.test(text) && !REJECT.test(text);

const pad = (n: number) => String(n).padStart(2, "0");
const toNumber = (digits: string) => Number(digits.replace(/,/g, ""));
const isoOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const timeOf = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * A month / day from the text, with the year from when the notice arrived: a December payment
 * read in January belongs to last year.
 */
function dateFrom(month: number, day: number, postedAt: Date) {
  const year = month > postedAt.getMonth() + 1 ? postedAt.getFullYear() - 1 : postedAt.getFullYear();
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Known apps' names, for when the phone couldn't read an app's label. */
const APP_NAMES: Record<string, string> = {
  "com.kakaobank.channel": "카카오뱅크",
  "com.kbcard.cxh.appcard": "KB Pay",
};

const appLabel = (raw: RawNotice) =>
  APP_NAMES[raw.packageName] ?? (raw.appName && !raw.appName.includes(".") ? raw.appName : raw.packageName);

// ── 카카오뱅크 ─────────────────────────────────────────────────────────────────────────────
// 제목 "출금 8,600원", 본문 "입출금통장(3786) → 쿠팡\n잔액 331,357원". The arrow points to where
// the money went: "입출금통장(3786) → 송우진" out, "홍길동 → 입출금통장(3786)" in.
const KAKAO_TITLE = /^(출금|입금)?\s*(취소)?\s*([\d,]+)\s*원/;
const KAKAO_ACCOUNT = /^(.*?)\((\d{4})\)$/;

function kakaoBank(raw: RawNotice): ParsedNotice | null {
  if (raw.packageName !== "com.kakaobank.channel") return null;
  const title = raw.title.match(KAKAO_TITLE);
  if (!title) return null;
  const line = raw.text.split("\n").map((l) => l.trim()).find((l) => /[→←]/.test(l));
  if (!line) return null;
  const [left, right] = line.split(/\s*[→←]\s*/);
  const leftAccount = left?.match(KAKAO_ACCOUNT);
  const rightAccount = right?.match(KAKAO_ACCOUNT);
  const account = leftAccount ?? rightAccount;
  const counterparty = (leftAccount ? right : left)?.trim() ?? "";
  if (!account || !counterparty) return null;
  const posted = new Date(raw.postedAt);
  const word = title[1] ?? (line.indexOf("→") > -1 && leftAccount ? "출금" : "입금");
  const direction: NoticeDirection = title[2] || /취소/.test(raw.text) ? "cancel" : word === "입금" ? "in" : "out";
  const accountName = account[1].trim() || "통장";
  return {
    direction,
    amount: toNumber(title[3]),
    currency: "KRW",
    date: isoOf(posted),
    time: timeOf(posted),
    counterparty,
    source: {
      key: `카카오뱅크|${account[2]}`,
      label: `카카오뱅크 ${accountName} ${account[2]}`,
      kind: "account",
    },
    installment: 0,
    via: "template",
  };
}

// ── 카드 승인 (KB Pay and the cards' SMS of the same shape) ─────────────────────────────────
// "KB국민카드2222승인 송*진님 8,800원 일시불 11/19 14:06 쿠팡(쿠페이) 누적490,530원"
const CARD_APPROVAL =
  /([가-힣A-Za-z]*카드)\s*\(?(\d{4}|\d\*\d\*)\)?\s*(승인취소|취소|승인)\s*(?:[가-힣]\*[가-힣]?\s*님?)?\s*([\d,]+)\s*원\s*\(?(일시불|\d{1,2}\s*개월)?\)?\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s+(.+?)(?:\s*(?:누적|잔여|잔액)\s*[\d,]+\s*원.*)?$/;

function cardApproval(raw: RawNotice): ParsedNotice | null {
  const text = oneLine(raw.text);
  const m = text.match(CARD_APPROVAL);
  if (!m) return null;
  const [, issuer, number, word, amount, plan, month, day, hour, minute, merchant] = m;
  const counterparty = merchant.trim();
  if (!counterparty) return null;
  const posted = new Date(raw.postedAt);
  return {
    direction: word.includes("취소") ? "cancel" : "out",
    amount: toNumber(amount),
    currency: "KRW",
    date: dateFrom(Number(month), Number(day), posted),
    time: `${pad(Number(hour))}:${minute}`,
    counterparty,
    source: { key: `${issuer}|${number}`, label: `${issuer} ${number}`, kind: "card" },
    installment: plan && plan !== "일시불" ? Number(plan.replace(/\D/g, "")) : 0,
    via: "template",
  };
}

// ── 그 밖의 문자 ────────────────────────────────────────────────────────────────────────────
const DATETIME = /(\d{1,2})[\/.\-](\d{1,2})\s*(\d{1,2}):(\d{2})/;
const ISSUER = /([가-힣A-Za-z]+(?:카드|체크|은행|뱅크|증권|페이))/;
const NUMBER = /[(\[]([\d*]{4})[)\]]|(?:카드|체크|통장|계좌)\s*(\d{4}|\d\*\d\*)/;
const INSTALLMENT = /(\d{1,2})\s*개월/;

/** The 거래 금액: the first amount that isn't a 누적 / 잔액 / 한도. */
function pickAmount(text: string) {
  for (const m of text.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/g)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 5), m.index);
    if (/누적|잔액|한도|잔여/.test(before)) continue;
    return toNumber(m[1]);
  }
  return null;
}

/** What the generic reader takes out of the text; what's left is the 가맹점. */
const NOISE: RegExp[] = [
  /\[[^\]]{1,12}\]/g,
  /[(\[][\d*\-]{3,}[)\]]/g,
  /\d{2,6}-[\d*]{2,6}-[\d*]{2,8}/g,
  /(누적|잔액|잔여\s*한도|한도)\s*:?\s*[\d,]+\s*원/g,
  /[\d,]+\s*원/g,
  new RegExp(DATETIME.source, "g"),
  /일시불|\d{1,2}\s*개월|할부/g,
  /[가-힣]\*[가-힣]?\s*님?/g,
  /[가-힣A-Za-z]+(카드|체크|은행|뱅크|증권|페이)\s*[(\[]?[\d*]{0,4}[)\]]?/g,
  /승인취소|승인|취소|결제|사용|출금|입금|이체/g,
  /[(\[]\s*[)\]]/g,
];

function generic(raw: RawNotice): ParsedNotice | null {
  // A text message's title is its sender: a number adds nothing, a name ("출금 1원") might.
  const title = /^[\d\s+\-#()]*$/.test(raw.title) ? "" : raw.title;
  const text = oneLine(`${title} ${raw.text}`);
  const amount = pickAmount(text);
  if (!amount) return null;
  const posted = new Date(raw.postedAt);
  const direction: NoticeDirection = /취소/.test(text)
    ? "cancel"
    : /(^|\s)입금/.test(text) && !/(^|\s)출금/.test(text)
      ? "in"
      : "out";
  let date = isoOf(posted);
  let time = timeOf(posted);
  const dt = text.match(DATETIME);
  if (dt) {
    date = dateFrom(Number(dt[1]), Number(dt[2]), posted);
    time = `${pad(Number(dt[3]))}:${dt[4]}`;
  }
  let rest = text;
  for (const re of NOISE) rest = rest.replace(re, " ");
  const counterparty = oneLine(rest);
  if (!counterparty || counterparty.length > 40 || /\d{5,}/.test(counterparty)) return null;
  const issuer = text.match(ISSUER)?.[1] ?? appLabel(raw);
  const numberMatch = text.match(NUMBER);
  const number = numberMatch?.[1] ?? numberMatch?.[2] ?? "";
  const installment = text.match(INSTALLMENT);
  const isCard = /카드|체크/.test(issuer);
  return {
    direction,
    amount,
    currency: "KRW",
    date,
    time,
    counterparty,
    source: {
      key: `${issuer}|${number}`,
      label: number ? `${issuer} ${number}` : issuer,
      kind: isCard ? "card" : "account",
    },
    installment: installment ? Number(installment[1]) : 0,
    via: "generic",
  };
}

/** The notice's fields, or null when only the model can read it. */
export function parseNotice(raw: RawNotice): ParsedNotice | null {
  return kakaoBank(raw) ?? cardApproval(raw) ?? generic(raw);
}

/** Where a notice the model read came from: its app, the card or account number if it gave one. */
export function sourceFor(raw: RawNotice, number: string, kind: "card" | "account"): NoticeSource {
  const issuer = appLabel(raw);
  return { key: `${issuer}|${number}`, label: number ? `${issuer} ${number}` : issuer, kind };
}

/** The 가맹점 / 상대방 as a lookup key: no spaces or brackets, lower case. */
export const counterpartyKey = (value: string) => value.replace(/[\s()\[\]]/g, "").toLowerCase();
