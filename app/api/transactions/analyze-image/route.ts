import { NextResponse } from "next/server";
import type { ImageTransactionAnalysis } from "@/lib/transaction-image";

export const runtime = "nodejs";

const DEFAULT_MODEL = "openai/gpt-5.4-mini";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_COUNT = 5;
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type ContextAccount = { id: string; name: string; type?: string };
type ContextCategory = {
  majorCategory: string;
  minorCategory: string;
  transactionType: "income" | "expense";
};
type AnalysisContext = {
  month: string;
  defaultAccountId: string;
  accounts: ContextAccount[];
  categories: ContextCategory[];
};

type OpenRouterMessageContent =
  | string
  | Array<{ type?: string; text?: string; content?: string }>;

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: OpenRouterMessageContent } }>;
  error?: { message?: string };
};

const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(request: Request) {
  const now = Date.now();
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 10;
}

function parseContext(value: FormDataEntryValue | null): AnalysisContext | null {
  if (typeof value !== "string" || value.length > 50_000) return null;
  try {
    const parsed = JSON.parse(value) as AnalysisContext;
    if (
      !/^\d{4}-\d{2}$/.test(parsed.month) ||
      !Array.isArray(parsed.accounts) ||
      !Array.isArray(parsed.categories)
    ) {
      return null;
    }
    return {
      month: parsed.month,
      defaultAccountId: String(parsed.defaultAccountId ?? ""),
      accounts: parsed.accounts.slice(0, 200).map((account) => ({
        id: String(account.id),
        name: String(account.name),
        type: account.type ? String(account.type) : undefined,
      })),
      categories: parsed.categories.slice(0, 500).map((category) => ({
        majorCategory: String(category.majorCategory),
        minorCategory: String(category.minorCategory),
        transactionType:
          category.transactionType === "income" ? "income" : "expense",
      })),
    };
  } catch {
    return null;
  }
}

function normalizeAnalysis(
  value: unknown,
  context: AnalysisContext,
): ImageTransactionAnalysis {
  const root = value as { transactions?: unknown[] };
  const accountIds = new Set(context.accounts.map((account) => account.id));
  const fallbackAccountId = accountIds.has(context.defaultAccountId)
    ? context.defaultAccountId
    : context.accounts[0]?.id ?? "";
  const categoriesByType = {
    income: context.categories.filter((category) => category.transactionType === "income"),
    expense: context.categories.filter((category) => category.transactionType === "expense"),
  };

  const transactions = (Array.isArray(root.transactions) ? root.transactions : [])
    .slice(0, 50)
    .map((item) => {
      const row = item as Record<string, unknown>;
      const type =
        row.type === "income" || row.type === "transfer" ? row.type : "expense";
      const options = categoriesByType[type === "income" ? "income" : "expense"];
      const matchedCategory = options.find(
        (category) =>
          category.majorCategory === row.category &&
          category.minorCategory === row.minorCategory,
      ) ?? options.find((category) => category.majorCategory === row.category);
      const fallbackCategory = options[0];
      const rawDate = String(row.date ?? "");
      const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : `${context.month}-01`;
      const amount = Math.round(Math.abs(Number(row.amount) || 0));
      const accountId = accountIds.has(String(row.accountId))
        ? String(row.accountId)
        : fallbackAccountId;
      const toAccountId =
        type === "transfer" &&
        accountIds.has(String(row.toAccountId)) &&
        String(row.toAccountId) !== accountId
          ? String(row.toAccountId)
          : "";

      return {
        id: crypto.randomUUID(),
        date,
        name: String(row.name ?? "").trim().slice(0, 120),
        amount,
        type: type === "transfer" && !toAccountId ? "expense" : type,
        accountId,
        toAccountId,
        category: matchedCategory?.majorCategory ?? fallbackCategory?.majorCategory ?? "기타",
        minorCategory: matchedCategory?.minorCategory ?? fallbackCategory?.minorCategory ?? "기타",
        confidence: Math.min(1, Math.max(0, Number(row.confidence) || 0)),
      } satisfies ImageTransactionAnalysis["transactions"][number];
    })
    .filter((row) => row.name && row.amount > 0 && accountIds.has(row.accountId));

  return { transactions };
}

function getMessageText(content: OpenRouterMessageContent | undefined) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? part.content ?? "")
      .join("")
      .trim();
  }
  return "";
}

function parseAnalysisContent(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    const fencedJson = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
    if (fencedJson) return JSON.parse(fencedJson);
    const objectStart = content.indexOf("{");
    const objectEnd = content.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(content.slice(objectStart, objectEnd + 1));
    }
    throw new Error("OpenRouter returned non-JSON content");
  }
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      { error: "사진 분석 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenRouter API 키가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "사진을 읽을 수 없습니다." }, { status: 400 });
  }
  const images = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File);
  const context = parseContext(formData.get("context"));
  if (!images.length || !context) {
    return NextResponse.json({ error: "사진 또는 분석 정보가 올바르지 않습니다." }, { status: 400 });
  }
  if (images.length > MAX_IMAGE_COUNT) {
    return NextResponse.json(
      { error: `사진은 한 번에 최대 ${MAX_IMAGE_COUNT}장까지 선택할 수 있습니다.` },
      { status: 400 },
    );
  }
  if (images.some((image) => !ALLOWED_IMAGE_TYPES.has(image.type))) {
    return NextResponse.json(
      { error: "JPG, PNG, WEBP, GIF 사진만 사용할 수 있습니다." },
      { status: 415 },
    );
  }
  const totalImageBytes = images.reduce((total, image) => total + image.size, 0);
  if (images.some((image) => !image.size || image.size > MAX_IMAGE_BYTES)) {
    return NextResponse.json(
      { error: "각 사진은 8MB 이하만 사용할 수 있습니다." },
      { status: 413 },
    );
  }
  if (totalImageBytes > MAX_TOTAL_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "선택한 사진의 합계 용량은 20MB 이하로 맞춰 주세요." },
      { status: 413 },
    );
  }
  const dataUrls = await Promise.all(
    images.map(async (image) => {
      const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
      return `data:${image.type};base64,${base64}`;
    }),
  );
  const prompt = [
    `사용자가 직접 제공한 은행/카드 거래 화면 또는 영수증 사진 ${images.length}장이다. 사진 순서는 선택 순서다.`,
    "모든 사진에서 실제로 보이는 거래만 사진 순서와 각 사진의 위에서 아래 순서대로 추출하라. 잔액, 합계, 광고 문구는 거래로 만들지 마라.",
    "같은 거래가 연속된 화면에 중복해서 보이면 한 번만 추출하라.",
    `기준 연월은 ${context.month}이다. 연도가 생략된 날짜는 이 연도를 사용하고, 월/일이 생략된 영수증은 기준 연월을 사용하라.`,
    "출금 또는 음수 금액은 expense, 입금 또는 양수 금액은 income이다.",
    "'자동이체'라는 문구만으로 transfer로 분류하지 마라. 제공된 두 계좌 사이의 이동이 명확할 때만 transfer를 사용하라.",
    "accountId, toAccountId, category, minorCategory는 아래 허용 목록의 값을 정확히 사용하라.",
    `기본 계좌 ID: ${context.defaultAccountId || "없음"}`,
    `계좌 목록: ${JSON.stringify(context.accounts)}`,
    `카테고리 목록: ${JSON.stringify(context.categories)}`,
    "계좌를 특정할 수 없으면 기본 계좌 ID를 사용하라. transfer가 아니면 toAccountId는 빈 문자열이다.",
    "카테고리는 거래 유형과 일치하는 가장 가까운 항목을 고른다. confidence는 각 행 판독 확신도 0~1이다.",
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(process.env.OPENROUTER_SITE_URL
          ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
          : {}),
        "X-OpenRouter-Title": "Mirae Household Ledger",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...dataUrls.map((url) => ({
                type: "image_url" as const,
                image_url: { url },
              })),
            ],
          },
        ],
        reasoning: { effort: "low", exclude: true },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ledger_image_transactions",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                transactions: {
                  type: "array",
                  maxItems: 50,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      date: { type: "string", description: "YYYY-MM-DD" },
                      name: { type: "string" },
                      amount: { type: "number", description: "Positive absolute KRW amount" },
                      type: { type: "string", enum: ["income", "expense", "transfer"] },
                      accountId: { type: "string" },
                      toAccountId: { type: "string" },
                      category: { type: "string" },
                      minorCategory: { type: "string" },
                      confidence: { type: "number" },
                    },
                    required: [
                      "date",
                      "name",
                      "amount",
                      "type",
                      "accountId",
                      "toAccountId",
                      "category",
                      "minorCategory",
                      "confidence",
                    ],
                  },
                },
              },
              required: ["transactions"],
            },
          },
        },
        provider: { require_parameters: true },
        plugins: [{ id: "response-healing" }],
        max_tokens: 5000,
      }),
    });
    const payload = (await response.json()) as OpenRouterResponse;
    if (!response.ok) {
      console.error("OpenRouter image analysis failed", response.status, payload.error?.message);
      return NextResponse.json(
        { error: "사진 분석에 실패했습니다. 잠시 후 다시 시도해 주세요." },
        { status: response.status === 429 ? 429 : 502 },
      );
    }
    const content = getMessageText(payload.choices?.[0]?.message?.content);
    if (!content) throw new Error("OpenRouter returned no content");
    const analysis = normalizeAnalysis(parseAnalysisContent(content), context);
    if (!analysis.transactions.length) {
      return NextResponse.json(
        { error: "사진에서 등록할 거래를 찾지 못했습니다." },
        { status: 422 },
      );
    }
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Image transaction analysis error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.name === "AbortError"
            ? "사진 분석 시간이 초과되었습니다. 다시 시도해 주세요."
            : "사진 분석 결과 형식이 올바르지 않습니다. 사진 수를 줄여 다시 시도해 주세요.",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
