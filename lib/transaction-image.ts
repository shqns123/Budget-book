export type ImageTransactionDraft = {
  id: string;
  date: string;
  name: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  accountId: string;
  toAccountId: string;
  category: string;
  minorCategory: string;
  confidence: number;
};

export type ImageTransactionAnalysis = {
  transactions: ImageTransactionDraft[];
};
