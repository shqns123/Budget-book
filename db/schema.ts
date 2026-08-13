import { boolean, date, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const accountType = pgEnum("account_type", ["cash", "bank", "card", "loan", "savings"]);
export const transactionType = pgEnum("transaction_type", ["income", "expense", "transfer"]);
export const accountClassification = pgEnum("account_classification", ["asset", "short_liability", "long_liability"]);

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: accountType("type").notNull(),
  classification: accountClassification("classification").notNull().default("asset"),
  majorCategory: text("major_category").notNull(),
  minorCategory: text("minor_category").notNull(),
  accountCode: text("account_code").notNull(),
  openingBalance: integer("opening_balance").notNull().default(0),
  memo: text("memo"),
  isHidden: boolean("is_hidden").notNull().default(false),
  color: text("color").notNull().default("#17191c"),
  paymentDay: integer("payment_day"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  toAccountId: uuid("to_account_id").references(() => accounts.id, { onDelete: "set null" }),
  transferGroupId: uuid("transfer_group_id"),
  transactionDate: date("transaction_date").notNull(),
  type: transactionType("type").notNull(),
  category: text("category").notNull(),
  minorCategory: text("minor_category"),
  amount: integer("amount").notNull(),
  memo: text("memo"),
  isFixed: boolean("is_fixed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const budgets = pgTable("budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: text("category").notNull(),
  month: date("month").notNull(),
  monthlyLimit: integer("monthly_limit").notNull(),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionType: transactionType("transaction_type").notNull().default("expense"),
  majorCategory: text("major_category").notNull(),
  minorCategory: text("minor_category").notNull(),
  isFixed: boolean("is_fixed").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isHidden: boolean("is_hidden").notNull().default(false),
});

export const householdSettings = pgTable("household_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  startYear: integer("start_year").notNull(),
  fiscalStartMonth: integer("fiscal_start_month").notNull().default(1),
});
