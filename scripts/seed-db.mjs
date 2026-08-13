import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(currentDirectory, "..", "data", "imported-ledger.json");
const data = JSON.parse(await fs.readFile(dataPath, "utf8"));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL이 필요합니다.");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");
  await client.query("TRUNCATE TABLE transactions, budgets, categories, accounts, household_settings RESTART IDENTITY CASCADE");

  await client.query(
    "INSERT INTO household_settings (id, start_year, fiscal_start_month) VALUES ($1, $2, $3)",
    ["8a6be571-29c5-4d6d-81a1-65a3318f68f3", data.settings.startYear, data.settings.fiscalStartMonth],
  );

  for (const account of data.accounts) {
    await client.query(
      `INSERT INTO accounts (id, name, type, classification, major_category, minor_category, account_code, opening_balance, memo, is_hidden, color, payment_day)
       VALUES ($1, $2, $3::account_type, $4::account_classification, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [account.id, account.name, account.type, account.classification, account.majorCategory, account.minorCategory, account.accountCode, account.openingBalance, account.memo, account.isHidden, account.color, account.paymentDay],
    );
  }

  for (const category of data.categories) {
    await client.query(
      `INSERT INTO categories (id, transaction_type, major_category, minor_category, is_fixed, sort_order, is_hidden)
       VALUES ($1, $2::transaction_type, $3, $4, $5, $6, $7)`,
      [category.id, category.transactionType, category.majorCategory, category.minorCategory, category.isFixed, category.sortOrder, category.isHidden],
    );
  }

  for (const transaction of data.transactions) {
    await client.query(
      `INSERT INTO transactions (id, account_id, to_account_id, transfer_group_id, transaction_date, type, category, minor_category, amount, memo, is_fixed)
       VALUES ($1, $2, $3, $4, $5::date, $6::transaction_type, $7, $8, $9, $10, $11)`,
      [transaction.id, transaction.accountId, transaction.toAccountId, transaction.transferGroupId, transaction.date, transaction.type, transaction.category, transaction.minorCategory, transaction.amount, transaction.memo, transaction.isFixed],
    );
  }

  await client.query("COMMIT");
  console.log(`가계부 이관 완료: 계좌 ${data.accounts.length}개, 카테고리 ${data.categories.length}개, 거래 ${data.transactions.length}건`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
